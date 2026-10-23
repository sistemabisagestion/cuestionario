import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { startDevelopment, isTestDatabase, portInUse, PROJECT_INSTANCE, PROJECT_ROOT, INSTANCE_DIR, previousInstanceCheck } from '../scripts/dev.mjs';
import { localMatrixStore } from '../server/matrix-store.js';
import { seedMissingMatrices } from '../server/matrix-bootstrap.js';
import defaults from '../shared/matrix-defaults.json' with { type: 'json' };

const password = 'launcher-fixture-only';
let directory, instance, base;
async function freePort() {
  const server = createServer();
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();
  await new Promise(done => server.close(done));
  return port;
}
async function captureErrors(action) {
  const original = console.error, lines = [];
  console.error = (...args) => lines.push(args.join(' '));
  try { return { result: await action(), output: lines.join('\n') }; } finally { console.error = original; }
}
const post = (path, body, headers = {}) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, ...headers }, body: JSON.stringify(body) });

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'bisa-launcher-'));
  const docs = Object.fromEntries(Object.entries(defaults).map(([type, mapping]) => [type, { schema: 1, current: { revision: `fixture-${type}`, updatedAt: '2026-10-22T00:00:00Z', mapping }, previous: null }]));
  await seedMissingMatrices(localMatrixStore(directory), docs, async () => {});
  // Inherited variables take precedence over the env files, so no real credential or database is used.
  Object.assign(process.env, { MATRICES_STORAGE: 'local', MATRICES_LOCAL_DIR: directory, ADMIN_PASSWORD: password,
    SESSION_SECRET: 'launcher-fixture-secret-'.repeat(3), DATABASE_URL: '', BISA_API_PORT: String(await freePort()), BISA_WEB_PORT: String(await freePort()) });
  const original = console.log;
  console.log = () => {};
  try { instance = await startDevelopment(); } finally { console.log = original; }
  base = `http://localhost:${instance.webPort}`;
});
after(async () => {
  await instance?.close();
  process.exitCode = 0;
  assert.equal(dirname(directory), resolve(tmpdir())); assert.match(basename(directory), /^bisa-launcher-/);
  await rm(directory, { recursive: true, force: true });
});

test('one command serves the web page and the API through the single proxy configuration', async () => {
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /BISA - Evaluación de Estándares/);
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.service, 'bisaquiz-dev');
  assert.equal(health.storage, 'local');
  assert.equal(health.adminAuthConfigured, true);
  assert.equal(health.results, 'disabled');
});
test('administrator login works without a second terminal and keeps the session', async () => {
  const login = await post('/api/session', { password });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.deepEqual(await (await fetch(`${base}/api/session`, { headers: { Cookie: cookie } })).json(), { admin: true });
  for (const type of ['nuevo-ingreso', 'personal-antiguo']) {
    const file = join(directory, `${type}.json`), before = await readFile(file);
    const matrix = await (await fetch(`${base}/api/matrices?type=${type}`, { headers: { Cookie: cookie } })).json();
    assert.deepEqual(matrix.mapping, defaults[type]);
    assert.deepEqual(await readFile(file), before);
  }
});
test('through the Vite proxy, writes from another site are refused (CSRF) and same-site writes work', async () => {
  const foreign = await post('/api/session', { password }, { Origin: 'https://sitio-ajeno.example' });
  assert.equal(foreign.status, 403);
  const foreignData = await post('/api/datos', { module: 'links', action: 'preview', mode: 'parcial', rows: [] }, { Origin: 'https://sitio-ajeno.example' });
  assert.equal(foreignData.status, 403);
  assert.equal((await post('/api/session', { password })).status, 200);
});
test('wrong password, disabled results and unknown routes return distinct JSON errors', async () => {
  const wrong = await post('/api/session', { password: 'deliberately-invalid-fixture' });
  assert.equal(wrong.status, 401);
  assert.deepEqual(await wrong.json(), { error: 'Contraseña incorrecta', code: 'INVALID_ADMIN_CREDENTIALS' });
  const results = await fetch(`${base}/api/intentos`);
  assert.equal(results.status, 503);
  assert.equal((await results.json()).code, 'RESULTS_UNAVAILABLE');
  assert.equal((await fetch(`${base}/api/missing`)).status, 404);
});
test('a second start in the same process cannot stop itself: it reports the running instance', async () => {
  const { result, output } = await captureErrors(() => startDevelopment());
  assert.equal(result, null);
  assert.equal(process.exitCode, 1);
  assert.match(output, new RegExp(`puerto ${instance.webPort} \\(página web\\) ya está ocupado por una instancia anterior de BISAQUIZ`));
  assert.match(output, new RegExp(`puerto ${instance.apiPort} \\(API local\\)`));
  assert.match(output, /No se detuvo ningún otro proceso/);
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  process.exitCode = 0;
});
test('a port held by another program is reported with its PID and is not stopped', async () => {
  const foreign = createServer(socket => socket.destroy());
  await new Promise(done => foreign.listen(0, '127.0.0.1', done));
  const saved = { web: process.env.BISA_WEB_PORT, api: process.env.BISA_API_PORT };
  try {
    process.env.BISA_WEB_PORT = String(foreign.address().port); process.env.BISA_API_PORT = String(await freePort());
    const { result, output } = await captureErrors(() => startDevelopment());
    assert.equal(result, null);
    assert.match(output, /por otro programa/);
    if (process.platform === 'win32') {
      assert.match(output, new RegExp(`PID ${process.pid}\\b`));
      assert.match(output, /Comando: .*node/i);
    }
    assert.equal(foreign.listening, true);
    assert.equal(await portInUse(foreign.address().port), true);
  } finally {
    Object.assign(process.env, { BISA_WEB_PORT: saved.web, BISA_API_PORT: saved.api });
    process.exitCode = 0;
    await new Promise(done => foreign.close(done));
  }
});
async function until(check, label, ms = 30000) {
  for (const start = Date.now(); Date.now() - start < ms;) { if (await check()) return; await new Promise(done => setTimeout(done, 200)); }
  throw new Error(`Tiempo agotado: ${label}`);
}
const healthOf = async port => { try { return await (await fetch(`http://localhost:${port}/api/health`)).json(); } catch { return null; } };
test('an earlier npm run dev of this project (possibly outdated) is stopped and replaced; foreign instances are not', async () => {
  const web = await freePort(), api = await freePort();
  const env = { ...process.env, BISA_WEB_PORT: String(web), BISA_API_PORT: String(api), DATABASE_URL: '' };
  const previous = spawn(process.execPath, ['scripts/dev.mjs'], { env, stdio: 'ignore', windowsHide: true });
  const exited = new Promise(done => previous.once('exit', done));
  try {
    await until(async () => (await healthOf(web))?.pid === previous.pid, 'instancia anterior');
    assert.equal((await healthOf(api)).instance, PROJECT_INSTANCE);
    const saved = { web: process.env.BISA_WEB_PORT, api: process.env.BISA_API_PORT };
    Object.assign(process.env, { BISA_WEB_PORT: String(web), BISA_API_PORT: String(api) });
    let second;
    const original = console.log, lines = [];
    console.log = (...args) => lines.push(args.join(' '));
    try { second = await startDevelopment(); } finally { console.log = original; Object.assign(process.env, { BISA_WEB_PORT: saved.web, BISA_API_PORT: saved.api }); }
    try {
      await exited;
      assert.ok(second, 'la nueva instancia inició');
      assert.ok(lines.some(line => line.includes(`Se detuvo la instancia anterior de BISAQUIZ de esta instalación (PID ${previous.pid}`)));
      await assert.rejects(readFile(join(INSTANCE_DIR, `${previous.pid}.json`)), { code: 'ENOENT' }); // its record is removed
      assert.equal((await healthOf(web)).pid, process.pid);
      assert.equal((await healthOf(api)).routes.includes('/api/datos'), true);
    } finally { await second?.close(); }
  } finally { if (previous.exitCode === null) previous.kill(); }

  // Impostors are never stopped: another installation, or this installation's public identifier
  // without the record (or with a forged record) that only a real instance writes in this folder.
  const impostor = async (instance, secret) => {
    const port = await freePort();
    const script = `require('http').createServer((q, r) => { r.setHeader('Content-Type', 'application/json'); r.end(JSON.stringify({ service: 'bisaquiz-dev', instance: ${JSON.stringify(instance)}, secret: ${JSON.stringify(secret)}, pid: process.pid })); }).listen(${port}, '127.0.0.1')`;
    const child = spawn(process.execPath, ['-e', script], { stdio: 'ignore', windowsHide: true });
    await until(async () => (await healthOf(port))?.pid === child.pid, 'impostor');
    return { child, port };
  };
  const cases = [
    [await impostor('otro-proyecto', 'x'), null, /otra instalación|scripts\/dev\.mjs/],
    [await impostor(PROJECT_INSTANCE, 'secreto-copiado'), null, /scripts\/dev\.mjs|no existe/],
    [await impostor(PROJECT_INSTANCE, 'secreto-copiado'), 'forjado', /scripts\/dev\.mjs|secreto|registro/],
  ];
  try {
    for (const [{ child, port }, forged, reason] of cases) {
      if (forged) await writeFile(join(INSTANCE_DIR, `${child.pid}.json`), JSON.stringify({ pid: child.pid, root: PROJECT_ROOT, secret: 'otro-secreto', startedAt: Date.now() }));
      const check = await previousInstanceCheck(port);
      assert.equal(check.pid, null); assert.match(check.reason, reason);
      Object.assign(process.env, { BISA_WEB_PORT: String(port), BISA_API_PORT: String(await freePort()) });
      const { result, output } = await captureErrors(() => startDevelopment());
      assert.equal(result, null);
      assert.match(output, /No se detuvo automáticamente: /);
      assert.equal(child.exitCode, null);
      assert.equal((await healthOf(port)).pid, child.pid);
      process.exitCode = 0;
    }
  } finally {
    process.exitCode = 0;
    for (const [{ child }] of cases) { child.kill(); await unlink(join(INSTANCE_DIR, `${child.pid}.json`)).catch(() => {}); }
  }
});
test('results routes are only enabled for the verified Neon test branch', () => {
  assert.equal(isTestDatabase('postgresql://u:p@ep-nameless-hat-b5zjb2mk-pooler.c-7.us-east-2.aws.neon.tech/neondb'), true);
  assert.equal(isTestDatabase('postgresql://u:p@ep-other-branch-00000000-pooler.c-7.us-east-2.aws.neon.tech/neondb'), false);
  assert.equal(isTestDatabase(''), false);
});
