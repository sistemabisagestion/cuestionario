import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, dirname, basename, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import defaults from '../shared/matrix-defaults.json' with { type: 'json' };
import { extractLiteral, compareMappings } from '../scripts/recover-matrices.mjs';
import { localMatrixStore } from '../server/matrix-store.js';
import { seedMissingMatrices } from '../server/matrix-bootstrap.js';

const exec = promisify(execFile);
const documents = Object.fromEntries(Object.entries(defaults).map(([type, mapping]) => [type, { schema: 1, current: { revision: `initial-${type}`, updatedAt: '2026-10-22T00:00:00Z', mapping }, previous: null }]));
test('recovered original assignments match intake literal, staff Git HEAD and archived backups exactly', async () => {
  const nuevo = extractLiteral(await readFile('src/data/nuevoIngresoMapping.ts', 'utf8'), 'LEGACY_MATRIZ_NUEVO_INGRESO');
  const original = (await exec('git', ['show', 'HEAD:src/data/index.ts'], { encoding: 'utf8', windowsHide: true })).stdout;
  const staff = Object.entries(extractLiteral(original, 'cargoEstandarMapping')).map(([cargo, estandares]) => ({ cargo, estandares }));
  for (const [type, recovered, assignments] of [['nuevo-ingreso', nuevo, 185], ['personal-antiguo', staff, 670]]) {
    const difference = compareMappings(recovered, defaults[type]);
    assert.equal(difference.exact, true); assert.deepEqual(difference.missing, []); assert.deepEqual(difference.added, []);
    assert.equal(difference.cargosOriginal, 31); assert.equal(difference.assignmentsOriginal, assignments);
  }
});
test('migration creates each missing matrix once and never overwrites subsequent administrator updates', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bisa-recovery-'));
  try {
    const store = localMatrixStore(directory);
    const first = await seedMissingMatrices(store, documents, async () => assert.fail('No existing documents on first run'));
    assert.ok(first.every(row => row.status === 'created'));
    const old = await store.read('nuevo-ingreso');
    const official = { schema: 1, current: { revision: 'admin-updated', updatedAt: '2026-10-23T00:00:00Z', mapping: defaults['nuevo-ingreso'].slice(0, 1) }, previous: old.document.current };
    await store.write('nuevo-ingreso', official, old.etag);
    const originalBytes = await readFile(join(directory, 'nuevo-ingreso.json'));
    const backups = [];
    const second = await seedMissingMatrices(store, documents, async (type, document) => backups.push({ type, document }));
    assert.ok(second.every(row => row.status === 'preserved-existing'));
    assert.deepEqual(await readFile(join(directory, 'nuevo-ingreso.json')), originalBytes);
    assert.deepEqual(backups.find(row => row.type === 'nuevo-ingreso').document, official);
    assert.deepEqual((await store.read('personal-antiguo')).document, documents['personal-antiguo']);
  } finally {
    assert.equal(dirname(directory), resolve(tmpdir())); assert.match(basename(directory), /^bisa-recovery-/);
    await rm(directory, { recursive: true, force: true });
  }
});
test('invalid source data prevents either initial matrix from being written', async () => {
  let calls = 0;
  const bad = structuredClone(documents); bad['personal-antiguo'].current.mapping[0].estandares = ['UNKNOWN'];
  const store = { read: async () => { calls++; return null; }, write: async () => { calls++; } };
  await assert.rejects(seedMissingMatrices(store, bad, async () => {}), /inválidas/);
  assert.equal(calls, 0);
});
test('concurrent first import preserves the winning version rather than overwriting it', async () => {
  let reads = 0; const backups = [];
  const store = {
    read: async type => ++reads === 1 ? null : { document: documents[type], etag: 'winner' },
    write: async () => { throw Object.assign(new Error('Conflict'), { status: 409 }); },
  };
  const results = await seedMissingMatrices(store, documents, async (type, document) => backups.push({ type, document }));
  assert.ok(results.every(row => row.status === 'preserved-existing')); assert.equal(backups.length, 2);
});
test('Blob initial import defaults to offline dry-run and refuses apply without explicit authorization', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bisa-bootstrap-'));
  try {
    const report = { validated: true, artifacts: {} };
    for (const [type, document] of Object.entries(documents)) {
      const text = JSON.stringify(document);
      await writeFile(join(directory, `matriz-${type}.json`), text);
      report.artifacts[type] = { jsonSha256: createHash('sha256').update(text).digest('hex') };
    }
    await writeFile(join(directory, 'recovery-report.json'), JSON.stringify(report));
    const options = { windowsHide: true, env: { ...process.env, MATRICES_STORAGE: 'disabled', MATRICES_BLOB_APPROVED: 'false' } };
    const dry = await exec(process.execPath, ['scripts/import-initial-matrices.mjs', '--source', directory], options);
    assert.match(dry.stdout, /Sin acceso a Blob/);
    await assert.rejects(exec(process.execPath, ['scripts/import-initial-matrices.mjs', '--source', directory, '--apply'], options), error => /autorización explícita/.test(error.stderr));
    await writeFile(join(directory, 'matriz-nuevo-ingreso.json'), '{}');
    await assert.rejects(exec(process.execPath, ['scripts/import-initial-matrices.mjs', '--source', directory], options), error => /cambió desde su validación/.test(error.stderr));
  } finally {
    assert.equal(dirname(directory), resolve(tmpdir())); assert.match(basename(directory), /^bisa-bootstrap-/);
    await rm(directory, { recursive: true, force: true });
  }
});
