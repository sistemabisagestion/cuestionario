import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import XLSX from 'xlsx-js-style';
import { localMatrixStore, blobMatrixStore, configuredMatrixStore } from '../server/matrix-store.js';
import { resetConfiguredDatasetStore } from '../server/dataset-store.js';
import matricesEndpoint from '../api/matrices.js';
import { codesForCargo, validateRows, validateMapping } from '../shared/matrices.mjs';
import { checkExcelContainer, matrixWorkbook } from '../shared/matrix-excel.mjs';
import codes from '../shared/standard-codes.json' with { type: 'json' };
import { createServer } from 'node:http';

// Publishing, versions and restore of matrices are covered by datasets.test.mjs.
// This file covers the legacy matrix documents (still read as the initial version),
// the read-only /api/matrices endpoint and the matrix validation helpers.
const first = [{ cargo: 'Supervisor', estandares: [codes[0], codes[1]] }];
const second = [{ cargo: 'Supervisor', estandares: [codes[2]] }, { cargo: 'Cargo nuevo', estandares: [codes[3]] }];
const intake = 'nuevo-ingreso', staff = 'personal-antiguo';
let directory, server, base;
const request = (type, options = {}) => fetch(`${base}/api/matrices?type=${type}`, options);
async function snapshot(type) {
  const response = await request(type);
  assert.equal(response.status, 200);
  return response.json();
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'bisa-matrices-'));
  server = createServer(matricesEndpoint);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  // Directory is an explicitly created test fixture under tmpdir.
  assert.equal(dirname(directory), resolve(tmpdir()));
  assert.match(basename(directory), /^bisa-matrices-/);
  await rm(directory, { recursive: true, force: true });
});

test('no storage enabled implicitly and production cannot use local files', async () => {
  delete process.env.MATRICES_STORAGE;
  await assert.rejects(configuredMatrixStore(), { status: 503 });
  process.env.MATRICES_STORAGE = 'local'; process.env.VERCEL = '1';
  await assert.rejects(configuredMatrixStore(), { status: 503 });
  delete process.env.MATRICES_STORAGE; delete process.env.VERCEL;
});

test('empty store has no assignments or fallback; existing legacy document is served read-only', async () => {
  process.env.MATRICES_STORAGE = 'local'; process.env.MATRICES_LOCAL_DIR = directory; resetConfiguredDatasetStore();
  const empty = await snapshot(intake);
  assert.deepEqual(empty.mapping, []); assert.equal(empty.revision, 'matriz-vacia');
  assert.deepEqual(codesForCargo(empty.mapping, 'Supervisor'), []);
  assert.equal((await request('../escape')).status, 400);
  await localMatrixStore(directory).write(staff, { schema: 1, current: { revision: 'r1', updatedAt: '2026-10-22T00:00:00Z', mapping: second }, previous: null }, null);
  const legacy = await snapshot(staff);
  assert.deepEqual(legacy.mapping, second); assert.equal(legacy.revision, 'legado-r1');
  assert.deepEqual(codesForCargo(legacy.mapping, '  SUPERVISOR  '), [codes[2]]);
  assert.equal((await request(staff, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 405);
  assert.equal((await request(staff)).headers.get('cache-control'), 'no-store');
});

test('corrupt legacy matrix fails closed, never returns other matrix or default assignments', async () => {
  const { writeFile } = await import('node:fs/promises');
  const file = join(directory, `${staff}.json`), valid = await readFile(file, 'utf8');
  await writeFile(file, '{broken');
  try { assert.equal((await request(staff)).status, 503); }
  finally { await writeFile(file, valid); }
  assert.deepEqual((await snapshot(staff)).mapping, second);
});

const bytes = workbook => XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
test('recovery Excel helper roundtrips both matrices, including empty headers', () => {
  for (const mapping of [first, second]) {
    const rows = XLSX.utils.sheet_to_json(XLSX.read(bytes(matrixWorkbook(XLSX, mapping))).Sheets.Matriz).map(row => ({ cargo: row.Cargo, estandar: row['Estándar'] }));
    const result = validateRows(rows, codes);
    assert.deepEqual(result.errors, []); assert.deepEqual(result.mapping, mapping);
  }
  const empty = matrixWorkbook(XLSX, []);
  assert.deepEqual(XLSX.utils.sheet_to_json(empty.Sheets.Matriz, { header: 1 }), [['Cargo', 'Estándar']]);
});
test('blank cargos/codes, duplicate pairs, unknown codes are blocking', () => {
  const result = validateRows([
    { cargo: '', estandar: codes[0] }, { cargo: 'X', estandar: '' }, { cargo: 'X', estandar: codes[1] }, { cargo: ' x ', estandar: codes[1] }, { cargo: 'Y', estandar: 'INVALID' },
  ], codes);
  assert.equal(result.errors.length, 4);
  assert.equal(validateMapping([{ cargo: 'X', estandares: [codes[0], codes[1]] }], codes).errors.length, 0);
  assert.equal(validateRows('bad', codes).errors.length, 1);
});
// Formulas, headers and extra columns of uploads are covered through /api/datos in datasets.test.mjs.
test('Excel container check blocks oversized files, huge ZIP contents and macros before parsing', () => {
  assert.doesNotThrow(() => checkExcelContainer(bytes(matrixWorkbook(XLSX, first))));
  assert.throws(() => checkExcelContainer(new ArrayBuffer(1048577)), /1 MB/);
  assert.throws(() => checkExcelContainer(new TextEncoder().encode('no es un excel').buffer), /válido/);
  const zip = bytes(matrixWorkbook(XLSX, first)), view = new DataView(zip);
  for (let i = 0; i < zip.byteLength - 46; i++) {
    if (view.getUint32(i, true) === 0x02014b50) { view.setUint32(i + 24, 9 * 1048576, true); break; }
  }
  assert.throws(() => checkExcelContainer(zip), /descomprimido/);
  const macro = matrixWorkbook(XLSX, first); macro.vbaraw = new Uint8Array([1, 2, 3]);
  assert.throws(() => checkExcelContainer(XLSX.write(macro, { type: 'array', bookType: 'xlsm' })), /no permitido/);
});
test('server standard catalog matches bundled question bank exactly', async () => {
  const files = (await readdir(new URL('../src/data/', import.meta.url))).filter(f => /^SGI-.*\.json$/.test(f));
  const actual = await Promise.all(files.map(async file => JSON.parse(await readFile(new URL(`../src/data/${file}`, import.meta.url), 'utf8')).estandar_codigo));
  assert.deepEqual(actual.sort(), [...codes].sort());
});

test('Blob SDK adapter uses private consistent reads, conditional writes, create-only and real exception classes', async () => {
  class BlobPreconditionFailedError extends Error {} // SDK subclasses keep Error.name.
  const records = new Map(), calls = [];
  const sdk = {
    BlobPreconditionFailedError,
    async get(path, options) {
      calls.push(['get', path, options]);
      const record = records.get(path); if (!record) return null;
      const text = JSON.stringify(record.document);
      return { statusCode: 200, stream: new Response(text).body, blob: { etag: record.etag, size: text.length } };
    },
    async put(path, text, options) {
      calls.push(['put', path, options]);
      const old = records.get(path);
      if ((!options.allowOverwrite && old) || (options.ifMatch && options.ifMatch !== old?.etag)) throw new BlobPreconditionFailedError();
      const record = { document: JSON.parse(text), etag: `etag-${calls.length}` };
      records.set(path, record); return { etag: record.etag };
    },
  };
  const blob = blobMatrixStore(sdk);
  assert.equal(await blob.read(intake), null);
  const document = { schema: 1, current: { revision: 'v1', mapping: first }, previous: null };
  const initial = await blob.write(intake, document, null);
  await assert.rejects(blob.write(intake, document, null), { status: 409 });
  assert.deepEqual((await blob.read(intake)).document, document);
  await blob.write(intake, { ...document, previous: document.current }, initial.etag);
  await assert.rejects(blob.write(intake, document, initial.etag), { status: 409 });
  assert.equal(await blob.read(staff), null);
  for (const [operation, , options] of calls) {
    assert.equal(options.access, 'private');
    if (operation === 'get') assert.equal(options.useCache, false);
    else if (options.allowOverwrite) assert.ok(options.ifMatch);
    else assert.equal(options.ifMatch, undefined);
  }
});

test('Blob creation race reported as generic SDK error and failed replacements retain recoverable data', async () => {
  let record = null, fail = false, loseResponse = false;
  const sdk = {
    async get() {
      if (!record) return null;
      const text = JSON.stringify(record.document);
      return { statusCode: 200, stream: new Response(text).body, blob: { etag: record.etag, size: text.length } };
    },
    async put(path, text, options) {
      if (!options.allowOverwrite && record) throw new Error('Vercel Blob: This blob already exists');
      if (fail) throw new Error('Storage unavailable');
      record = { document: JSON.parse(text), etag: `etag-${record ? 2 : 1}` };
      if (loseResponse) throw new Error('Response lost after commit');
      return { etag: record.etag };
    },
  };
  const blob = blobMatrixStore(sdk);
  const initial = { schema: 1, current: { revision: '1', mapping: first }, previous: null };
  await blob.write(intake, initial, null);
  await assert.rejects(blob.write(intake, initial, null), { status: 409 });
  fail = true;
  await assert.rejects(blob.write(intake, { ...initial, current: { revision: '2', mapping: second }, previous: initial.current }, 'etag-1'));
  assert.deepEqual((await blob.read(intake)).document, initial);
  fail = false; loseResponse = true;
  const changed = { ...initial, current: { revision: '2', mapping: second }, previous: initial.current };
  await assert.rejects(blob.write(intake, changed, 'etag-1'));
  const recovered = await blob.read(intake);
  assert.deepEqual(recovered.document.current.mapping, second);
  assert.deepEqual(recovered.document.previous.mapping, first);
});
