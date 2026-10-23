import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import XLSX from 'xlsx-js-style';
import { createLocalApiServer } from '../scripts/dev.mjs';
import { localMatrixStore } from '../server/matrix-store.js';
import { seedMissingMatrices } from '../server/matrix-bootstrap.js';
import { blobDatasetStore, localDatasetStore } from '../server/dataset-store.js';
import { activeDataset } from '../server/datasets.js';
import { DATASETS, RESULTS_EXPORT, toRows } from '../shared/datasets.mjs';
import { tableWorkbook } from '../shared/excel-tables.mjs';
import { DEFAULT_QUESTIONS, DEFAULT_LINKS } from '../shared/default-datasets.mjs';
import defaults from '../shared/matrix-defaults.json' with { type: 'json' };
import { frontendModules } from './helpers/frontend-modules.mjs';

// Real HTTP API (same routes as npm run dev) on a temporary local store seeded with the
// recovered original matrices. Nothing here touches .local-matrices, Neon or Blob.
const PASSWORD = 'datasets-fixture-only';
let directory, server, base, admin, participant;
const sha = text => createHash('sha256').update(text).digest('hex');
const legacyHashes = {};

async function start() {
  server = await createLocalApiServer();
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
}
async function login(body) {
  const response = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}
const get = async (query, cookie = '') => {
  const response = await fetch(`${base}/api/datos?${query}`, { headers: cookie ? { Cookie: cookie } : {} });
  return { status: response.status, body: await response.json() };
};
const current = async module => (await get(`module=${module}`)).body;
async function post(body, { cookie = admin, headers = {} } = {}) {
  const response = await fetch(`${base}/api/datos`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const excel = async (module, rows) => Buffer.from(await tableWorkbook(ExcelJS, DATASETS[module], rows));
const file = async (module, rows, name = 'datos.xlsx') => ({ name, base64: (await excel(module, rows)).toString('base64') });
function sheetFile(grid, sheet = 'Hoja1', name = 'datos.xlsx') {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(grid), sheet);
  return { name, base64: Buffer.from(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })).toString('base64') };
}
async function preview(module, rows, mode = 'parcial') { return post({ module, action: 'preview', mode, file: await file(module, rows) }); }
async function publish(module, rows, mode = 'parcial', extra = {}) {
  const base = extra.base ?? (await current(module)).version;
  return post({ module, action: 'publish', mode, base, file: await file(module, rows), ...extra });
}
const questionRows = async () => toRows('preguntas', (await current('preguntas')).data);

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'bisa-datasets-'));
  Object.assign(process.env, { MATRICES_STORAGE: 'local', MATRICES_LOCAL_DIR: directory, ADMIN_PASSWORD: PASSWORD, SESSION_SECRET: 'datasets-fixture-secret-'.repeat(3) });
  const docs = Object.fromEntries(Object.entries(defaults).map(([type, mapping]) => [type, { schema: 1, current: { revision: `original-${type}`, updatedAt: '2026-10-22T00:00:00.000Z', mapping }, previous: null }]));
  await seedMissingMatrices(localMatrixStore(directory), docs, async () => {});
  for (const type of Object.keys(defaults)) legacyHashes[type] = sha(await readFile(join(directory, `${type}.json`)));
  await start();
  admin = await login({ password: PASSWORD });
  participant = await login({ dni: '12345678' });
});
after(async () => {
  if (server?.listening) await new Promise(done => server.close(done));
  assert.equal(dirname(directory), resolve(tmpdir())); assert.match(basename(directory), /^bisa-datasets-/);
  await rm(directory, { recursive: true, force: true });
});

test('current data is served unchanged: 1280 questions, 31 links, 185 and 670 assignments', async () => {
  const bank = await current('preguntas');
  assert.equal(bank.count, 1280); assert.equal(bank.data.length, 32); assert.equal(bank.source, 'incluida');
  assert.deepEqual(bank.data, DEFAULT_QUESTIONS);
  const links = await current('links');
  assert.equal(links.count, 31); assert.deepEqual(links.data, DEFAULT_LINKS);
  for (const [type, total] of [['nuevo-ingreso', 185], ['personal-antiguo', 670]]) {
    const matrix = await current(type);
    assert.equal(matrix.data.length, 31); assert.equal(matrix.count, total); assert.equal(matrix.source, 'legado');
    assert.deepEqual(matrix.data, defaults[type]);
  }
  // A client that already holds the active version receives no payload again.
  assert.deepEqual((await get(`module=preguntas&known=${bank.version}`)).body, { module: 'preguntas', version: bank.version, unchanged: true });
});

test('exports of all five modules are native Excel tables with filters, banded rows, frozen header and widths', async () => {
  const specs = [...Object.entries(DATASETS).map(([module, spec]) => [spec, null, module]), [RESULTS_EXPORT, [{ tipo: 'NUEVO INGRESO', id: 'x1', nota: 15, estado: 'Aprobado' }], null]];
  const names = new Set();
  for (const [spec, fixedRows, module] of specs) {
    const rows = fixedRows ?? toRows(module, (await current(module)).data);
    const buffer = Buffer.from(await tableWorkbook(ExcelJS, spec, rows));
    const zip = await JSZip.loadAsync(buffer);
    const tables = Object.keys(zip.files).filter(name => /^xl\/tables\/table\d+\.xml$/.test(name));
    assert.equal(tables.length, 1, spec.table);
    const xml = await zip.file(tables[0]).async('string');
    assert.match(xml, new RegExp(`name="${spec.table}"`)); assert.match(xml, new RegExp(`displayName="${spec.table}"`));
    assert.match(xml, new RegExp(`ref="A1:[A-Z]+${rows.length + 1}"`));
    assert.match(xml, /<autoFilter /); assert.match(xml, /showRowStripes="1"/);
    for (const column of spec.columns) assert.ok(xml.includes(`name="${column.header}"`), column.header);
    const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
    assert.match(sheet, /<pane [^>]*ySplit="1"[^>]*state="frozen"/);
    assert.match(sheet, /<col [^>]*width=/);
    assert.ok(/^[A-Za-z_][A-Za-z0-9_]*$/.test(spec.table) && !names.has(spec.table)); names.add(spec.table);
    // Readable again with the original headers and every record.
    const parsed = XLSX.read(buffer, { type: 'buffer' });
    const grid = XLSX.utils.sheet_to_json(parsed.Sheets[spec.sheet], { header: 1, defval: '' });
    assert.deepEqual(grid[0], spec.columns.map(column => column.header));
    assert.equal(grid.length - 1, rows.length);
  }
});

test('unchanged export re-imported in both modes shows no changes and publishes nothing', async () => {
  for (const module of Object.keys(DATASETS)) {
    const rows = toRows(module, (await current(module)).data);
    for (const mode of ['parcial', 'completa']) {
      const { status, body } = await preview(module, rows, mode);
      assert.equal(status, 200, module);
      assert.deepEqual(body.errors, []);
      assert.deepEqual({ ...body.counts }, { received: rows.length, added: 0, modified: 0, removed: 0, unchanged: rows.length, total: rows.length });
    }
    const result = await publish(module, rows, 'completa');
    assert.equal(result.status, 200); assert.equal(result.body.unchanged, true);
  }
  // No version or manifest was written for a no-op.
  await assert.rejects(readdir(join(directory, 'datos')), { code: 'ENOENT' });
});

test('partial update adds and modifies questions; preview and confirmation precede publication', async () => {
  const rows = await questionRows();
  const before = await current('preguntas');
  const edited = rows.map(row => ({ ...row }));
  edited[0].pregunta = `${edited[0].pregunta} (revisada)`;
  edited[1].respuesta = edited[1].respuesta === 'A' ? 'B' : 'A';
  const added = { ...rows[2], id: 901, pregunta: '¿Pregunta nueva agregada desde Excel?' };
  const upload = [edited[0], edited[1], added]; // partial: only the changed rows
  const { body: view } = await preview('preguntas', upload, 'parcial');
  assert.equal(view.valid, true);
  assert.deepEqual({ ...view.counts }, { received: 3, added: 1, modified: 2, removed: 0, unchanged: 0, total: 1281 });
  assert.deepEqual(view.changes.modified.map(item => item.fields), [['Pregunta'], ['Respuesta Correcta']]);
  assert.deepEqual(view.changes.added, [`${added.codigo} · pregunta 901`]);
  // Preview alone did not publish anything.
  assert.equal((await current('preguntas')).version, before.version);
  const published = await publish('preguntas', upload, 'parcial', { base: view.base });
  assert.equal(published.status, 200, JSON.stringify(published.body));
  assert.deepEqual(published.body.summary, { added: 1, modified: 2, removed: 0, unchanged: 0 });
  const after = await current('preguntas');
  assert.equal(after.count, 1281); assert.notEqual(after.version, before.version); assert.equal(after.source, 'publicada');
  const after0 = after.data.find(est => est.estandar_codigo === rows[0].codigo).preguntas.find(p => p.id === rows[0].id);
  assert.match(after0.pregunta, /\(revisada\)$/);
  // Other questions are untouched.
  assert.deepEqual(after.data.find(est => est.estandar_codigo === 'CL-ES-GOP-SGI-36'), DEFAULT_QUESTIONS.find(est => est.estandar_codigo === 'CL-ES-GOP-SGI-36'));
});

test('full synchronization lists deletions and requires an explicit, exact confirmation', async () => {
  const rows = await questionRows();
  const keep = rows.filter(row => !(row.codigo === 'CL-ES-GOP-SGI-03' && row.id <= 3));
  const { body: view } = await preview('preguntas', keep, 'completa');
  assert.equal(view.counts.removed, 3); assert.equal(view.changes.removed.length, 3);
  const partial = await preview('preguntas', keep, 'parcial');
  assert.equal(partial.body.counts.removed, 0); // partial never deletes
  const before = (await current('preguntas')).version;
  for (const confirmDeletions of [undefined, 2, true]) {
    const refused = await publish('preguntas', keep, 'completa', { confirmDeletions });
    assert.equal(refused.status, 400); assert.equal(refused.body.code, 'CONFIRM_DELETIONS');
  }
  assert.equal((await current('preguntas')).version, before);
  const done = await publish('preguntas', keep, 'completa', { confirmDeletions: 3 });
  assert.equal(done.status, 200); assert.equal(done.body.summary.removed, 3);
  assert.equal((await current('preguntas')).count, rows.length - 3);
});

test('invalid files are rejected on the server and never published', async () => {
  const version = (await current('preguntas')).version;
  const good = (await questionRows()).slice(0, 2);
  const bad = async (module, rows) => (await preview(module, rows)).body;
  const cases = [
    await bad('preguntas', [{ ...good[0], respuesta: 'F' }]),
    await bad('preguntas', [{ ...good[0], a: '' }]),
    await bad('preguntas', [{ ...good[0], id: 'x' }]),
    await bad('preguntas', [good[0], good[0]]),
    await bad('preguntas', [{ ...good[0], codigo: 'codigo invalido' }]),
    await bad('preguntas', [{ ...good[0], nombre: 'Otro nombre' }]), // inconsistent with the rest of its standard
    await bad('links', [{ codigo: 'CL-ES-GOP-SGI-99', documento: 'https://x.sharepoint.com/a', video: '' }]),
    await bad('links', [{ codigo: 'CL-ES-GOP-SGI-03', documento: 'http://x.sharepoint.com/a', video: '' }]),
    await bad('links', [{ codigo: 'CL-ES-GOP-SGI-03', documento: 'javascript:alert(1)', video: '' }]),
    await bad('nuevo-ingreso', [{ cargo: 'Supervisor', estandar: 'CL-ES-GOP-SGI-99' }]),
    await bad('nuevo-ingreso', [{ cargo: '=HYPERLINK()', estandar: 'CL-ES-GOP-SGI-03' }]),
    await bad('nuevo-ingreso', [{ cargo: 'X', estandar: 'CL-ES-GOP-SGI-03' }, { cargo: ' x ', estandar: 'CL-ES-GOP-SGI-03' }]),
  ];
  for (const result of cases) { assert.equal(result.valid, false); assert.ok(result.errors.length > 0); }
  const structural = [
    sheetFile([['Puesto', 'Estándar'], ['X', 'CL-ES-GOP-SGI-03']]),
    sheetFile([['Cargo', 'Estándar', 'Extra'], ['X', 'CL-ES-GOP-SGI-03', '1']]),
    { name: 'datos.xlsx', base64: Buffer.from('no es un excel').toString('base64') },
    { name: 'datos.csv', base64: Buffer.from('Cargo,Estándar').toString('base64') },
    { name: 'datos.xlsx', base64: Buffer.alloc(1048577).toString('base64') },
  ];
  for (const upload of structural) {
    const result = await post({ module: 'nuevo-ingreso', action: 'preview', mode: 'parcial', file: upload });
    assert.ok([400, 413].includes(result.status), JSON.stringify(result.body));
  }
  const formula = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([['Cargo', 'Estándar'], ['X', 'CL-ES-GOP-SGI-03']]); sheet.B2 = { t: 's', v: 'CL-ES-GOP-SGI-03', f: 'CONCAT("CL-ES-GOP-SGI-","03")' };
  XLSX.utils.book_append_sheet(formula, sheet, 'Matriz');
  const withFormula = await post({ module: 'nuevo-ingreso', action: 'preview', mode: 'parcial', file: { name: 'm.xlsx', base64: Buffer.from(XLSX.write(formula, { type: 'array', bookType: 'xlsx' })).toString('base64') } });
  assert.equal(withFormula.status, 400); assert.match(withFormula.body.error, /fórmulas/);
  const refused = await publish('preguntas', [{ ...good[0], respuesta: 'F' }]);
  assert.equal(refused.status, 400); assert.equal(refused.body.code, 'INVALID_FILE');
  assert.equal((await current('preguntas')).version, version);
});

test('links: SharePoint links can be changed, added and validated; typed hyperlinks are accepted', async () => {
  const rows = toRows('links', (await current('links')).data);
  const changed = { ...rows[0], video: 'https://cobraperusa.sharepoint.com/:v:/s/Nuevo/video-actualizado' };
  const added = { codigo: 'CL-ES-GOP-SGI-21', documento: 'https://cobraperusa.sharepoint.com/:b:/g/documento-21', video: '' };
  const external = { ...rows[1], documento: 'https://example.com/doc' };
  const { body } = await preview('links', [changed, added, external]);
  assert.equal(body.valid, true); assert.equal(body.counts.added, 1); assert.equal(body.counts.modified, 2);
  assert.ok(body.warnings.some(text => /no apunta a SharePoint/.test(text)));
  // Excel converts typed URLs into hyperlinks: accepted when the target equals the text.
  const buffer = await excel('links', [changed]);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
  const cell = workbook.getWorksheet('Links').getCell('C2');
  cell.value = { text: changed.video, hyperlink: changed.video };
  const linked = await post({ module: 'links', action: 'preview', mode: 'parcial', file: { name: 'l.xlsx', base64: Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64') } });
  assert.equal(linked.status, 200, JSON.stringify(linked.body)); assert.equal(linked.body.valid, true);
  cell.value = { text: changed.video, hyperlink: 'https://malicioso.example/' };
  const mismatch = await post({ module: 'links', action: 'preview', mode: 'parcial', file: { name: 'l.xlsx', base64: Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64') } });
  assert.equal(mismatch.status, 400);
  assert.equal((await publish('links', [changed, added])).status, 200);
  const after = await current('links');
  assert.equal(after.count, 32); assert.equal(after.data['CL-ES-GOP-SGI-21'].documento, added.documento);
  assert.equal(after.data[rows[0].codigo].video, changed.video);
});

test('matrices: add, modify via full sync, relations to the question bank and controlled clear', async () => {
  const staff = toRows('personal-antiguo', (await current('personal-antiguo')).data);
  const added = { cargo: 'Cargo de prueba', estandar: 'CL-ES-GOP-SGI-03' };
  const partial = await publish('personal-antiguo', [added]);
  assert.equal(partial.status, 200); assert.equal((await current('personal-antiguo')).count, 671);
  // A standard used by a matrix cannot disappear from the question bank.
  const bank = await questionRows();
  const withoutSgi36 = bank.filter(row => row.codigo !== 'CL-ES-GOP-SGI-36');
  const blocked = await preview('preguntas', withoutSgi36, 'completa');
  assert.equal(blocked.body.valid, false);
  assert.ok(blocked.body.errors.some(text => /CL-ES-GOP-SGI-36.*Matriz/.test(text)));
  // A new standard published in the bank can then be assigned.
  const newStandard = { ...bank[0], codigo: 'CL-ES-GOP-SGI-40', nombre: 'Estándar de prueba', id: 1 };
  assert.equal((await preview('nuevo-ingreso', [{ cargo: 'Ayudante', estandar: 'CL-ES-GOP-SGI-40' }])).body.valid, false);
  assert.equal((await publish('preguntas', [newStandard])).status, 200);
  assert.equal((await preview('nuevo-ingreso', [{ cargo: 'Ayudante', estandar: 'CL-ES-GOP-SGI-40' }])).body.valid, true);
  // Full sync back to the original 670.
  const sync = await preview('personal-antiguo', staff, 'completa');
  assert.equal(sync.body.counts.removed, 1);
  assert.equal((await publish('personal-antiguo', staff, 'completa', { confirmDeletions: 1 })).status, 200);
  assert.deepEqual((await current('personal-antiguo')).data, defaults['personal-antiguo']);
  // Clear requires confirmation and stays restorable.
  const intake = await current('nuevo-ingreso');
  assert.equal((await post({ module: 'nuevo-ingreso', action: 'clear', base: intake.version })).status, 400);
  assert.equal((await post({ module: 'links', action: 'clear', base: (await current('links')).version, confirm: true })).status, 400);
  assert.equal((await post({ module: 'nuevo-ingreso', action: 'clear', base: intake.version, confirm: true })).status, 200);
  assert.equal((await current('nuevo-ingreso')).count, 0);
  const { body: history } = await get('module=nuevo-ingreso&view=versions', admin);
  const original = history.versions.find(version => version.action === 'version-existente');
  assert.equal(original.count, 185);
  const restored = await post({ module: 'nuevo-ingreso', action: 'restore', versionId: original.versionId, base: (await current('nuevo-ingreso')).version });
  assert.equal(restored.status, 200, JSON.stringify(restored.body));
  assert.deepEqual((await current('nuevo-ingreso')).data, defaults['nuevo-ingreso']);
  // The legacy matrix documents were never rewritten.
  for (const type of Object.keys(defaults)) assert.equal(sha(await readFile(join(directory, `${type}.json`))), legacyHashes[type]);
});

test('every publication is an immutable version; history and restore keep all backups', async () => {
  const { body: history } = await get('module=preguntas&view=versions', admin);
  assert.equal(history.storage, 'local');
  const actions = history.versions.map(version => version.action);
  assert.equal(actions.at(-1), 'version-incluida');
  assert.equal(history.versions[0].versionId, history.active);
  for (const version of history.versions) {
    assert.match(version.versionId, /^[0-9A-Za-z-]+$/); assert.ok(version.createdAt); assert.equal(typeof version.count, 'number');
  }
  const files = await readdir(join(directory, 'datos', 'preguntas', 'versions'));
  assert.equal(files.length, history.versions.length);
  const original = history.versions.at(-1);
  const restored = await post({ module: 'preguntas', action: 'restore', versionId: original.versionId, base: history.active });
  // The original bank lacks the new standard SGI-40 only if nothing references it; it is unreferenced here.
  assert.equal(restored.status, 200, JSON.stringify(restored.body));
  const bank = await current('preguntas');
  assert.deepEqual(bank.data, DEFAULT_QUESTIONS); assert.equal(bank.count, 1280);
  const after = (await get('module=preguntas&view=versions', admin)).body;
  assert.equal(after.versions.length, history.versions.length + 1);
  assert.equal(after.versions[0].action, 'restauracion'); assert.equal(after.versions[0].restoredFrom, original.versionId);
  assert.equal((await readdir(join(directory, 'datos', 'preguntas', 'versions'))).length, files.length + 1);
  assert.equal((await post({ module: 'preguntas', action: 'restore', versionId: 'no-existe-1234', base: after.active })).status, 404);
  assert.equal((await post({ module: 'preguntas', action: 'restore', versionId: '../../x', base: after.active })).status, 404);
});

test('any published version can be read by id (to resume evaluations); unknown versions are 404', async () => {
  const { body: history } = await get('module=preguntas&view=versions', admin);
  const original = history.versions.at(-1);
  const old = await get(`module=preguntas&version=${original.versionId}`);
  assert.equal(old.status, 200); assert.equal(old.body.version, original.versionId); assert.equal(old.body.source, 'historica');
  assert.deepEqual(old.body.data, DEFAULT_QUESTIONS);
  const active = await get(`module=preguntas&version=${history.active}`);
  assert.equal(active.body.version, history.active); assert.equal(active.body.source, 'publicada');
  for (const id of ['no-existe-1234', '../../secreto']) assert.equal((await get(`module=preguntas&version=${encodeURIComponent(id)}`)).status, 404);
});

test('only authenticated administrators can preview, publish, restore, clear or list versions; CSRF rejected', async () => {
  const version = (await current('links')).version;
  const upload = await file('links', toRows('links', (await current('links')).data).slice(0, 1));
  const bodies = [
    { module: 'links', action: 'preview', mode: 'parcial', file: upload },
    { module: 'links', action: 'publish', mode: 'parcial', file: upload, base: version },
    { module: 'links', action: 'restore', versionId: version, base: version },
    { module: 'nuevo-ingreso', action: 'clear', confirm: true, base: (await current('nuevo-ingreso')).version },
  ];
  for (const body of bodies) {
    for (const cookie of ['', participant, 'bisa_admin=forged.signature']) assert.equal((await post(body, { cookie })).status, 401);
    assert.equal((await post(body, { headers: { Origin: 'https://untrusted.example' } })).status, 403);
  }
  assert.equal((await get('module=links&view=versions', participant)).status, 401);
  assert.equal((await get('module=../etc')).status, 400);
  assert.equal((await current('links')).version, version);
});

test('stale base and simultaneous publications have exactly one winner', async () => {
  const rows = toRows('links', (await current('links')).data);
  const base = (await current('links')).version;
  const one = { ...rows[0], video: 'https://cobraperusa.sharepoint.com/:v:/s/a/uno' };
  const two = { ...rows[0], video: 'https://cobraperusa.sharepoint.com/:v:/s/a/dos' };
  const results = await Promise.all([publish('links', [one], 'parcial', { base }), publish('links', [two], 'parcial', { base })]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal((await publish('links', [one], 'parcial', { base })).status, 409);
  const winner = (await current('links')).data[rows[0].codigo].video;
  assert.ok([one.video, two.video].includes(winner));
});

test('all users read the same published version; an evaluation in progress keeps its copy', async () => {
  const { datasets } = await frontendModules();
  const nativeFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = (url, options) => { requests.push(String(url)); return nativeFetch(new URL(url, base), options); };
  try {
    const started = await datasets.loadDataset('preguntas'); // evaluation started with this copy
    const snapshotJson = JSON.stringify(started.data);
    const otherUser = await current('preguntas');
    assert.equal(otherUser.version, started.version);
    const rows = toRows('preguntas', started.data);
    assert.equal((await publish('preguntas', [{ ...rows[5], pregunta: 'Texto publicado después del inicio' }])).status, 200);
    assert.equal(JSON.stringify(started.data), snapshotJson);
    const mark = requests.length;
    const next = await datasets.loadDataset('preguntas');
    assert.match(requests[mark], new RegExp(`known=${started.version}`)); // asks whether its copy is still active
    assert.notEqual(next.version, started.version);
    assert.equal((await current('preguntas')).version, next.version);
    const again = await datasets.loadDataset('preguntas');
    assert.equal(again, next); // unchanged version: cached copy, no second download
  } finally { globalThis.fetch = nativeFetch; }
});

test('publication survives an API restart and a fresh Node process', async () => {
  const before = await current('preguntas');
  await new Promise(done => server.close(done));
  await start();
  admin = await login({ password: PASSWORD });
  assert.deepEqual(await current('preguntas'), before);
  const script = `import { localDatasetStore } from './server/dataset-store.js'; import { activeDataset } from './server/datasets.js';
    const active = await activeDataset('preguntas', localDatasetStore(process.argv[1])); console.log(active.versionId);`;
  const output = await new Promise((done, fail) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script, join(directory, 'datos')], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env } });
    let text = '', errors = '';
    child.stdout.on('data', chunk => { text += chunk; }); child.stderr.on('data', chunk => { errors += chunk; });
    child.on('error', fail); child.on('close', code => code ? fail(new Error(errors)) : done(text.trim()));
  });
  assert.equal(output, before.version);
});

test('failed or corrupt storage keeps the previous version active and fails closed', async () => {
  const store = localDatasetStore(join(directory, 'datos'));
  const before = await activeDataset('links', store);
  const failing = { ...store, kind: 'local', writeManifest: async () => { throw new Error('simulated manifest failure'); } };
  const { handleDatasets } = await import('../server/datasets.js');
  const rows = toRows('links', before.data);
  const req = { method: 'POST', url: '/api/datos', headers: { cookie: admin }, body: { module: 'links', action: 'publish', mode: 'parcial', base: before.versionId, file: await file('links', [{ ...rows[0], video: 'https://cobraperusa.sharepoint.com/:v:/s/a/fallida' }]) } };
  await assert.rejects(handleDatasets(req, failing), /simulated manifest failure/);
  assert.equal((await activeDataset('links', store)).versionId, before.versionId);
  assert.equal((await current('links')).version, before.versionId);
  const manifest = join(directory, 'datos', 'links', 'manifest.json');
  const valid = await readFile(manifest, 'utf8');
  await writeFile(manifest, '{broken');
  try { assert.equal((await get('module=links')).status, 503); }
  finally { await writeFile(manifest, valid); }
  assert.equal((await current('links')).version, before.versionId);
});

// SIMULATION of @vercel/blob 2.8 as read from its source (not a real Blob Store):
// - get(): 404 → null; returns the HTTP ETag header (quoted here, unlike put/head);
// - put(): ifMatch mismatch → BlobPreconditionFailedError; existing path with
//   allowOverwrite:false → generic BlobError; ifMatch + allowOverwrite:false → BlobError;
// - head(): 404 → BlobNotFoundError; ETag valid for ifMatch;
// - the SDK retries, so a write can be stored and still report an error (lostResponse).
class BlobError extends Error {}
class BlobPreconditionFailedError extends BlobError {}
class BlobNotFoundError extends BlobError {}
function fakeBlobSdk() {
  const records = new Map(), calls = [];
  let counter = 0;
  const faults = { lostResponse: null, failPut: null };
  const sdk = {
    BlobError, BlobPreconditionFailedError, BlobNotFoundError, records, calls, faults,
    async get(path, options) {
      calls.push(['get', path, options]);
      const record = records.get(path); if (!record) return null;
      return { statusCode: 200, stream: new Response(record.text).body, blob: { etag: `"${record.etag}"`, size: record.text.length } };
    },
    async head(path) {
      calls.push(['head', path, {}]);
      const record = records.get(path); if (!record) throw new BlobNotFoundError('The requested blob does not exist');
      return { etag: record.etag, pathname: path };
    },
    async put(path, text, options) {
      calls.push(['put', path, options]);
      if (options.ifMatch && options.allowOverwrite === false) throw new BlobError('ifMatch and allowOverwrite: false are contradictory');
      if (faults.failPut?.(path)) throw new BlobError('The blob service is currently not available');
      const old = records.get(path);
      if (options.ifMatch && options.ifMatch !== old?.etag) throw new BlobPreconditionFailedError('Precondition failed: ETag mismatch.');
      if (!options.allowOverwrite && !options.ifMatch && old) throw new BlobError('This blob already exists');
      const etag = `etag-${++counter}`;
      records.set(path, { text, etag });
      if (faults.lostResponse?.(path)) { faults.lostResponse = null; throw new BlobError('Unknown error, please visit https://vercel.com/help.'); }
      return { etag, pathname: path };
    },
  };
  return sdk;
}

test('Blob adapter (simulated SDK): publish, read, restore, retries, lost responses and concurrency through the real handler', async () => {
  const { handleDatasets } = await import('../server/datasets.js');
  const sdk = fakeBlobSdk();
  const blob = blobDatasetStore(sdk);
  const call = body => handleDatasets({ method: 'POST', url: '/api/datos', headers: { cookie: admin }, body }, blob);
  const read = query => handleDatasets({ method: 'GET', url: `/api/datos?${query}`, headers: { cookie: admin } }, blob);
  const rows = toRows('links', DEFAULT_LINKS);
  const edit = video => ({ module: 'links', action: 'publish', mode: 'parcial', file: undefined, rows: [{ ...rows[0], video }] });

  // First publication: initial version + new version + manifest (create-only).
  const initial = await read('module=links');
  assert.equal(initial.version, 'inicial-incluida');
  const first = await call({ ...edit('https://cobraperusa.sharepoint.com/:v:/s/a/uno'), base: initial.version });
  assert.equal((await read('module=links')).version, first.version);
  assert.equal(JSON.parse(sdk.records.get('bisaquiz/datos/links/manifest.json').text).history.length, 2);

  // Second publication uses the head() ETag (get() returns a differently formatted one).
  const second = await call({ ...edit('https://cobraperusa.sharepoint.com/:v:/s/a/dos'), base: first.version });
  const manifestPut = sdk.calls.filter(([op, path]) => op === 'put' && path.endsWith('manifest.json')).at(-1);
  assert.match(manifestPut[2].ifMatch, /^etag-\d+$/);

  // Stale base and simultaneous publications: exactly one winner, no overwrite.
  await assert.rejects(call({ ...edit('https://cobraperusa.sharepoint.com/:v:/s/a/tarde'), base: first.version }), { status: 409 });
  const race = await Promise.allSettled([
    call({ ...edit('https://cobraperusa.sharepoint.com/:v:/s/a/x'), base: second.version }),
    call({ ...edit('https://cobraperusa.sharepoint.com/:v:/s/a/y'), base: second.version }),
  ]);
  assert.deepEqual(race.map(result => result.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(race.find(result => result.status === 'rejected').reason.status, 409);
  const winner = race.find(result => result.status === 'fulfilled').value.version;
  assert.equal((await read('module=links')).version, winner);

  // Manifest stored but the response was lost (SDK retry/timeout): reported as success.
  sdk.faults.lostResponse = path => path.endsWith('manifest.json');
  const lost = await call({ ...edit('https://cobraperusa.sharepoint.com/:v:/s/a/perdida'), base: winner });
  assert.equal((await read('module=links')).version, lost.version);

  // Version stored but the response was lost: identical content is accepted, not a conflict.
  sdk.faults.lostResponse = path => path.includes('/versions/');
  const lostVersion = await call({ ...edit('https://cobraperusa.sharepoint.com/:v:/s/a/version-perdida'), base: lost.version });
  assert.equal((await read('module=links')).version, lostVersion.version);

  // Service failure on the manifest: the previous version stays active.
  sdk.faults.failPut = path => path.endsWith('manifest.json');
  await assert.rejects(call({ ...edit('https://cobraperusa.sharepoint.com/:v:/s/a/fallo'), base: lostVersion.version }), /not available/);
  sdk.faults.failPut = null;
  assert.equal((await read('module=links')).version, lostVersion.version);

  // Restore the original, then every version is still stored (nothing deleted).
  const history = await read('module=links&view=versions');
  assert.equal(history.storage, 'blob');
  const original = history.versions.at(-1);
  await call({ module: 'links', action: 'restore', versionId: original.versionId, base: lostVersion.version });
  assert.deepEqual((await read('module=links')).data, DEFAULT_LINKS);
  const stored = [...sdk.records.keys()].filter(path => path.includes('/versions/'));
  // + restore and two unreferenced orphans (race loser, failed manifest swap), never served.
  assert.equal(stored.length, history.versions.length + 3);

  // Access and cache rules on every call.
  for (const [operation, path, options] of sdk.calls) {
    // Validating links also reads the published question bank.
    assert.match(path, /^bisaquiz\/datos\/(links|preguntas)\/(manifest\.json|versions\/[0-9A-Za-z-]+\.json)$/);
    if (operation === 'head') continue;
    assert.equal(options.access, 'private');
    if (operation === 'get') assert.equal(options.useCache, false);
    else if (path.includes('/versions/')) { assert.equal(options.allowOverwrite, false); assert.equal(options.ifMatch, undefined); }
    else if (options.allowOverwrite) assert.match(options.ifMatch, /^etag-\d+$/);
  }
  await assert.rejects(blob.readVersion('links', '../secret'), { status: 400 });
});

test('with storage disabled the built-in data is served read-only and publishing is refused', async () => {
  const { handleDatasets } = await import('../server/datasets.js');
  const view = await handleDatasets({ method: 'GET', url: '/api/datos?module=preguntas', headers: {} }, null);
  assert.equal(view.count, 1280); assert.equal(view.source, 'incluida');
  const req = { method: 'POST', url: '/api/datos', headers: { cookie: admin }, body: { module: 'links', action: 'publish', mode: 'parcial', base: 'inicial-incluida', rows: [] } };
  await assert.rejects(handleDatasets(req, null), { status: 503 });
});
