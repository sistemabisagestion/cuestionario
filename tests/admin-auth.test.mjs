import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createMatrixDevelopmentServer } from '../scripts/dev-matrices.mjs';
import { localMatrixStore } from '../server/matrix-store.js';
import { seedMissingMatrices } from '../server/matrix-bootstrap.js';
import defaults from '../shared/matrix-defaults.json' with { type: 'json' };
import { frontendModules } from './helpers/frontend-modules.mjs';

const nativeFetch = globalThis.fetch;
const testPassword = 'admin-auth-fixture-only';
const testSecret = 'admin-auth-fixture-secret-'.repeat(3);
let directory, server, vite, base, api, matrices, cookie = '', retainCookies = true, missingRoute = false;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'bisa-admin-auth-'));
  process.env.MATRICES_STORAGE = 'local'; process.env.MATRICES_LOCAL_DIR = directory;
  process.env.ADMIN_PASSWORD = testPassword; process.env.SESSION_SECRET = testSecret;
  const docs = Object.fromEntries(Object.entries(defaults).map(([type, mapping]) => [type, { schema: 1, current: { revision: `fixture-${type}`, updatedAt: '2026-10-22T00:00:00Z', mapping }, previous: null }]));
  await seedMissingMatrices(localMatrixStore(directory), docs, async () => {});
  server = createMatrixDevelopmentServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  vite = await createViteServer({ configFile: resolve('vite.config.ts'), configLoader: 'runner', logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, proxy: { '/api': { target: `http://127.0.0.1:${server.address().port}` } } },
  });
  await vite.listen(); base = `http://127.0.0.1:${vite.httpServer.address().port}`;
  ({ api, matrices } = await frontendModules());
  globalThis.fetch = async (url, options = {}) => {
    if (typeof url !== 'string' || !url.startsWith('/api/')) return nativeFetch(url, options);
    const headers = new Headers(options.headers); headers.set('Origin', base);
    if (cookie && retainCookies) headers.set('Cookie', cookie);
    const response = await nativeFetch(new URL(missingRoute ? '/api/session-missing' : url, base), { ...options, headers });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie && retainCookies) cookie = setCookie.split(';')[0];
    return response;
  };
});
after(async () => {
  globalThis.fetch = nativeFetch;
  await vite?.close();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  assert.equal(dirname(directory), resolve(tmpdir())); assert.match(basename(directory), /^bisa-admin-auth-/);
  await rm(directory, { recursive: true, force: true });
});

test('correct administrator login through real Vite proxy confirms HttpOnly cookie and session', async () => {
  const health = await api.apiRequest('health');
  assert.equal(health.adminAuthConfigured, true);
  await api.loginAdmin(testPassword);
  assert.match(cookie, /^bisa_admin=/);
  assert.deepEqual(await api.apiRequest('session'), { admin: true });
});
test('authenticated administrator can access both matrices and their version history without modifying data', async () => {
  for (const type of ['nuevo-ingreso', 'personal-antiguo']) {
    const file = join(directory, `${type}.json`), before = await readFile(file);
    const current = await matrices.loadMatrix(type);
    assert.deepEqual(current.mapping, defaults[type]);
    const history = await api.apiRequest(`datos?module=${type}&view=versions`);
    assert.equal(history.active, current.revision);
    assert.deepEqual(await readFile(file), before);
  }
});
test('incorrect password returns only the invalid credentials message and HTTP 401', async () => {
  await assert.rejects(api.loginAdmin('deliberately-invalid-fixture'), { message: 'Contraseña incorrecta', status: 401, code: 'INVALID_ADMIN_CREDENTIALS' });
});
test('missing password or invalid session secret is an internal server error, even for an incorrect input', async () => {
  try {
    delete process.env.ADMIN_PASSWORD;
    await assert.rejects(api.loginAdmin(testPassword), error => error.status === 503 && error.code === 'ADMIN_AUTH_ERROR' && error.message.startsWith('Error interno del servidor') && !error.message.includes(testPassword));
    process.env.ADMIN_PASSWORD = testPassword; process.env.SESSION_SECRET = 'short';
    await assert.rejects(api.loginAdmin('deliberately-invalid-fixture'), error => error.status === 503 && error.code === 'ADMIN_AUTH_ERROR');
  } finally { process.env.ADMIN_PASSWORD = testPassword; process.env.SESSION_SECRET = testSecret; }
});
test('unretained cookie is reported as session failure rather than invalid password', async () => {
  retainCookies = false;
  try { await assert.rejects(api.loginAdmin(testPassword), error => error.code === 'ADMIN_AUTH_ERROR' && /conservar la sesión/.test(error.message)); }
  finally { retainCookies = true; }
});
test('missing session route is reported as internal error, preserving backend detail', async () => {
  missingRoute = true;
  try { await assert.rejects(api.loginAdmin(testPassword), error => error.status === 404 && error.code === 'ADMIN_AUTH_ERROR' && error.message.startsWith('Error interno del servidor') && /Ruta API no encontrada/.test(error.message)); }
  finally { missingRoute = false; }
});
test('API stopped behind real Vite proxy is reported as server disconnected, never incorrect password', async () => {
  await new Promise(resolve => server.close(resolve));
  await assert.rejects(api.loginAdmin(testPassword), error => error.status === 503 && error.code === 'API_UNREACHABLE' && error.message.startsWith('Servidor desconectado') && /no se pudo conectar/.test(error.message));
});
test('network failure and unconfirmed successful response cannot be mistaken for valid login', async () => {
  const wrapper = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
    await assert.rejects(api.loginAdmin(testPassword), error => error.status === null && error.code === 'API_UNREACHABLE' && error.message.startsWith('Servidor desconectado'));
    globalThis.fetch = async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    await assert.rejects(api.loginAdmin(testPassword), error => /no confirmó el inicio/.test(error.message));
    globalThis.fetch = async () => new Response('', { status: 200, headers: { 'Content-Type': 'application/json' } });
    await assert.rejects(api.loginAdmin(testPassword), error => error.code === 'ADMIN_AUTH_ERROR' && error.message.startsWith('Error interno del servidor') && /respuesta vacía/.test(error.message));
  } finally { globalThis.fetch = wrapper; }
});
