import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

test('offline queue survives reload and sends final score once connectivity returns', async () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const source = await readFile(new URL('../src/utils/storage.ts', import.meta.url), 'utf8');
  const api = `export class ApiError extends Error {}
    export const apiRequest = (...args) => globalThis.mockApi(...args);
    export const withParticipant = async (dni, action) => action();`;
  const apiUrl = 'data:text/javascript;base64,' + Buffer.from(api).toString('base64');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace("from './api'", `from '${apiUrl}'`);
  const url = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
  let storage = await import(url);
  const intento = { id: 'offline-1', dni: '12345678', nombre: 'Test', cargo: 'Test', estandarCodigo: 'SGI-03', estandarNombre: 'Test', fecha: '2026-10-22T12:00:00Z', puntaje: 0, totalPreguntas: 10, respuestas: [], tipo: 'USUARIO ANTIGUO', intentoNum: 1 };
  globalThis.mockApi = async () => { throw new Error('offline'); };
  await storage.saveIntentoAsync(intento);
  await storage.saveIntentoAsync({ ...intento, puntaje: 18 });
  assert.equal(storage.getIntentos().length, 1);
  assert.equal(JSON.parse(values.get('bisa-neon-pending')).length, 1);
  // A new module instance represents reloading the browser with its localStorage intact.
  storage = await import(url + '#reload');
  const sent = [];
  globalThis.mockApi = async (path, options) => { sent.push(JSON.parse(options.body)); return { ok: true }; };
  await storage.syncPendingIntentos();
  assert.equal(sent.length, 1); assert.equal(sent[0].puntaje, 18);
  assert.equal(sent[0].tipo, intento.tipo); assert.equal(sent[0].intento_num, 1);
  assert.deepEqual(JSON.parse(values.get('bisa-neon-pending')), []);
  delete globalThis.localStorage; delete globalThis.mockApi;
});

test('final score queued during initial save is not discarded or overwritten', async () => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const source = await readFile(new URL('../src/utils/storage.ts', import.meta.url), 'utf8');
  const apiUrl = 'data:text/javascript;base64,' + Buffer.from(`export class ApiError extends Error {} export const apiRequest = (...args) => globalThis.mockApi(...args); export const withParticipant = async (dni, action) => action();`).toString('base64');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace("from './api'", `from '${apiUrl}'`);
  const storage = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64') + '#race');
  const intento = { id: 'race', dni: '12345678', nombre: 'Test', cargo: 'Test', estandarCodigo: 'SGI-03', estandarNombre: 'Test', fecha: '2026-10-22T12:00:00Z', puntaje: 0, totalPreguntas: 10, respuestas: [] };
  let release;
  const initialRequest = new Promise(resolve => { release = resolve; });
  const scores = [];
  globalThis.mockApi = async (_, options) => {
    scores.push(JSON.parse(options.body).puntaje);
    if (scores.length === 1) await initialRequest;
    return { ok: true };
  };
  const first = storage.saveIntentoAsync(intento);
  await new Promise(resolve => setImmediate(resolve));
  const final = storage.saveIntentoAsync({ ...intento, puntaje: 20 });
  release(); await Promise.all([first, final]);
  assert.deepEqual(scores, [0, 20]);
  assert.deepEqual(JSON.parse(values.get('bisa-neon-pending')), []);
  assert.equal(storage.getIntentos()[0].puntaje, 20);
  delete globalThis.localStorage; delete globalThis.mockApi;
});

test('a result the server refuses for good is kept apart and does not block later ones; network failures stay queued', async () => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const source = await readFile(new URL('../src/utils/storage.ts', import.meta.url), 'utf8');
  const api = `export class ApiError extends Error { constructor(message, status, code) { super(message); this.status = status; this.code = code; } }
    export const apiRequest = (...args) => globalThis.mockApi(...args);
    export const withParticipant = async (dni, action) => action();`;
  const apiUrl = 'data:text/javascript;base64,' + Buffer.from(api).toString('base64');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace("from './api'", `from '${apiUrl}'`);
  const { ApiError } = await import(apiUrl);
  const storage = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  const base = { dni: '12345678', nombre: 'Test', cargo: 'Test', estandarCodigo: 'SGI-03', estandarNombre: 'Test', puntaje: 15, totalPreguntas: 10, respuestas: [{ esCorrecta: true }], tipo: 'USUARIO ANTIGUO', intentoNum: 1 };
  globalThis.mockApi = async () => { throw new Error('offline'); };
  await storage.saveIntentoAsync({ ...base, id: 'tarde', fecha: '2026-10-22T10:00:00Z', ticket: 'vencido' });
  await storage.saveIntentoAsync({ ...base, id: 'a-tiempo', fecha: '2026-10-22T11:00:00Z', ticket: 'valido' });
  assert.equal(JSON.parse(values.get('bisa-neon-pending')).length, 2); // network failure: both stay queued
  const sent = [];
  globalThis.mockApi = async (path, options) => {
    const row = JSON.parse(options.body);
    if (row.id === 'tarde') throw new ApiError('El tiempo de la evaluación terminó', 409, 'TIME_EXCEEDED');
    sent.push(row); return { ok: true };
  };
  await storage.syncPendingIntentos();
  assert.deepEqual(sent.map(row => [row.id, row.ticket]), [['a-tiempo', 'valido']]);
  assert.deepEqual(JSON.parse(values.get('bisa-neon-pending')), []);
  const rejected = JSON.parse(values.get('bisa-intentos-rechazados'));
  assert.deepEqual(rejected.map(item => [item.intento.id, item.codigo]), [['tarde', 'TIME_EXCEEDED']]);
  assert.equal(storage.getIntentos().length, 2); // the local copy is never deleted
  delete globalThis.localStorage; delete globalThis.mockApi;
});
