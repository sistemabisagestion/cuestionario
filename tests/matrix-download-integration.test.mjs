import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { createServer as createViteServer } from 'vite';
import XLSX from 'xlsx-js-style';
import { createMatrixDevelopmentServer } from '../scripts/dev-matrices.mjs';
import { localMatrixStore } from '../server/matrix-store.js';
import { seedMissingMatrices } from '../server/matrix-bootstrap.js';
import defaults from '../shared/matrix-defaults.json' with { type: 'json' };
import { frontendModules } from './helpers/frontend-modules.mjs';

const nativeFetch = globalThis.fetch;
let directory, server, vite, base, api, tables, admin, port;
const initial = Object.fromEntries(Object.entries(defaults).map(([type, mapping]) => [type, { schema: 1, current: { revision: `original-${type}`, updatedAt: '2026-10-22T00:00:00.000Z', mapping }, previous: null }]));
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'bisa-downloads-'));
  process.env.MATRICES_STORAGE = 'local'; process.env.MATRICES_LOCAL_DIR = directory;
  process.env.ADMIN_PASSWORD = 'download-test-only'; process.env.SESSION_SECRET = 'download-test-secret-'.repeat(4);
  await seedMissingMatrices(localMatrixStore(directory), initial, async () => {});
  server = createMatrixDevelopmentServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
  vite = await createViteServer({ configFile: resolve('vite.config.ts'), configLoader: 'runner', logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, proxy: { '/api': { target: `http://127.0.0.1:${port}` } } },
  });
  await vite.listen();
  base = `http://127.0.0.1:${vite.httpServer.address().port}`;
  ({ api, tables } = await frontendModules());
  // Only relative frontend requests are rebased; Vite's internal requests remain intact.
  globalThis.fetch = (url, options) => nativeFetch(typeof url === 'string' && url.startsWith('/api/') ? new URL(url, base) : url, options);
  const login = await nativeFetch(`${base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }) });
  assert.equal(login.status, 200); admin = login.headers.get('set-cookie').split(';')[0];
});
after(async () => {
  globalThis.fetch = nativeFetch;
  await vite?.close();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  assert.equal(dirname(directory), resolve(tmpdir())); assert.match(basename(directory), /^bisa-downloads-/);
  await rm(directory, { recursive: true, force: true });
});
function expectedRows(mapping) { return [['Cargo', 'Estándar'], ...mapping.flatMap(row => row.estandares.map(code => [row.cargo, code]))]; }
async function verifyDownload(type, mapping) {
  let saved;
  const current = await tables.downloadDatasetExcel(type, async file => {
    saved = file;
    await writeFile(join(directory, file.filename), new Uint8Array(file.bytes));
  });
  assert.deepEqual(current.data, mapping);
  assert.match(saved.filename, new RegExp(`^bisa-matriz-${type}-.*\\.xlsx$`));
  assert.equal(saved.contentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const actual = XLSX.read(await readFile(join(directory, saved.filename)), { type: 'buffer' });
  assert.deepEqual(actual.SheetNames, ['Matriz']);
  // Native tables always keep one (blank) data row; it carries no assignment.
  assert.deepEqual(XLSX.utils.sheet_to_json(actual.Sheets.Matriz, { header: 1, blankrows: false }), expectedRows(mapping));
  return saved;
}
test('the admin panel download path produces real XLSX files from original assignments through actual Vite proxy and API', async () => {
  await verifyDownload('nuevo-ingreso', defaults['nuevo-ingreso']);
  await verifyDownload('personal-antiguo', defaults['personal-antiguo']);
});
test('actual session authorizes updates; unauthorized admin operation returns JSON 401', async () => {
  const current = await api.apiRequest('matrices?type=personal-antiguo');
  await assert.rejects(api.apiRequest('datos', { method: 'POST', body: JSON.stringify({ module: 'personal-antiguo', action: 'clear', confirm: true, base: current.revision }) }), { status: 401 });
});
test('empty staff download has headers, never intake data; one-time import preserves administrative clearing', async () => {
  const before = await api.apiRequest('matrices?type=nuevo-ingreso');
  const current = await api.apiRequest('matrices?type=personal-antiguo');
  await api.apiRequest('datos', { method: 'POST', headers: { Cookie: admin, Origin: base }, body: JSON.stringify({ module: 'personal-antiguo', action: 'clear', confirm: true, base: current.revision }) });
  await verifyDownload('personal-antiguo', []);
  const backedUp = [];
  const seeded = await seedMissingMatrices(localMatrixStore(directory), initial, async (type, doc) => backedUp.push({ type, doc }));
  assert.ok(seeded.every(result => result.status === 'preserved-existing'));
  // The legacy document is never rewritten; the clear lives in the published versions.
  assert.deepEqual(backedUp.find(row => row.type === 'personal-antiguo').doc.current.mapping, defaults['personal-antiguo']);
  await verifyDownload('personal-antiguo', []);
  assert.deepEqual(await api.apiRequest('matrices?type=nuevo-ingreso'), before);
});
test('downloads retain original intake and updated staff state after restarting actual API server', async () => {
  await new Promise(resolve => server.close(resolve));
  server = createMatrixDevelopmentServer();
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  await verifyDownload('nuevo-ingreso', defaults['nuevo-ingreso']);
  await verifyDownload('personal-antiguo', []);
});
test('unavailable API produces JSON 503 through Vite and never saves a fake Excel', async () => {
  await new Promise(resolve => server.close(resolve));
  let saved = false;
  await assert.rejects(tables.downloadDatasetExcel('nuevo-ingreso', () => { saved = true; }), error => error.status === 503 && /no se pudo conectar/.test(error.message));
  assert.equal(saved, false);
});
