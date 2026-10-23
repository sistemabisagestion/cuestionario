import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { DEFAULT_QUESTIONS } from '../shared/default-datasets.mjs';

// Minimal per-tab storage, as in the browser.
class MemoryStorage {
  #items = new Map();
  getItem(key) { return this.#items.has(key) ? this.#items.get(key) : null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
}
async function session() {
  const source = await readFile(new URL('../src/utils/quizSession.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#${Math.random()}`);
}
const Q = 45_000;
const attempt = { id: 'intento-1', ticket: 'firmado', inicio: 0, limite: 0 };
const base = { dni: '12345678', tipo: 'USUARIO ANTIGUO', cargo: 'Ayudante', estandares: ['CL-ES-GOP-SGI-26'], bankVersion: 'v1', intentoNum: 1, keys: ['CL-ES-GOP-SGI-26#1', 'CL-ES-GOP-SGI-26#2', 'CL-ES-GOP-SGI-26#3'] };

test('a reload resumes the same attempt with answers, position and the remaining time (no reset)', async () => {
  const s = await session();
  globalThis.sessionStorage = new MemoryStorage();
  const t0 = 1_000_000;
  let state = s.newQuizState(base, attempt, t0);
  state = { ...state, respuestas: { 0: 'B' }, actual: 1, vencePregunta: t0 + 10_000 + Q }; // Q2 started at t0+10s
  s.saveQuizState('k', state);
  const reloaded = (await session()).readQuizState('k', '12345678');
  assert.deepEqual(reloaded, state);
  // 20 s later the question has 35 s left, not a fresh 45 s.
  const { state: resumed, expired, finished } = s.resumeQuiz(reloaded, t0 + 30_000);
  assert.deepEqual([resumed.actual, resumed.respuestas, expired, finished], [1, { 0: 'B' }, [], false]);
  assert.equal(s.remainingSeconds(resumed, t0 + 30_000), 25);
  // Another participant in the same tab never gets this state.
  assert.equal(s.readQuizState('k', '87654321'), null);
});

test('time that passed while closed is applied; extending the stored deadline gains nothing', async () => {
  const s = await session();
  const t0 = 2_000_000;
  const state = s.newQuizState(base, attempt, t0);
  // Away for 100 s: Q1 (45 s) and Q2 (next 45 s) expired, Q3 has 35 s left.
  const away = s.resumeQuiz(state, t0 + 100_000);
  assert.deepEqual([away.state.actual, away.expired, s.remainingSeconds(away.state, t0 + 100_000)], [2, [0, 1], 35]);
  // Past the whole schedule: finished.
  assert.equal(s.resumeQuiz(state, t0 + 3 * Q).finished, true);
  // Tampering: a deadline one hour ahead is capped by the schedule from the start.
  const tampered = { ...state, vencePregunta: t0 + 3_600_000 };
  assert.equal(s.resumeQuiz(tampered, t0 + 40_000).state.vencePregunta, t0 + Q);
  // Moving the stored position or start time cannot exceed one full question from now nor the limit.
  const moved = { ...state, inicio: t0 + 3_600_000, vencePregunta: t0 + 3_600_000 };
  assert.ok(s.resumeQuiz(moved, t0 + 40_000).state.vencePregunta <= t0 + 40_000 + Q);
  assert.ok(s.resumeQuiz(moved, t0 + 40_000).state.vencePregunta <= state.limite);
  // A reload while the result was being saved finishes it instead of showing the quiz again.
  assert.equal(s.resumeQuiz({ ...state, estado: 'finalizando' }, t0 + 1).finished, true);
});

test('questions are identified by standard code + id: categories never come from another standard', async () => {
  const s = await session();
  const pool = s.questionPool(DEFAULT_QUESTIONS.filter(est => ['CL-ES-GOP-SGI-26', 'CL-ES-GOP-SGI-27', 'CL-ES-GOP-SGI-28'].includes(est.estandar_codigo)));
  assert.equal(new Set(pool.map(entry => entry.key)).size, pool.length);
  // Question number 1 exists in all three standards.
  const ones = pool.filter(entry => entry.pregunta.id === 1);
  assert.equal(ones.length, 3);
  const keys = s.drawKeys(pool, 20, () => 0.5);
  assert.equal(new Set(keys).size, 20);
  const entries = s.entriesFor(pool, [...ones.map(entry => entry.key), ...keys.slice(0, 2)]);
  for (const entry of entries) {
    const est = DEFAULT_QUESTIONS.find(e => e.estandar_codigo === entry.codigo);
    assert.equal(entry.categoria, est.estandar_nombre);
    assert.deepEqual(est.preguntas.find(p => p.id === entry.pregunta.id), entry.pregunta); // same question, same answer
  }
  assert.deepEqual(entries.slice(0, 3).map(entry => entry.codigo), ['CL-ES-GOP-SGI-26', 'CL-ES-GOP-SGI-27', 'CL-ES-GOP-SGI-28']);
  // A key missing from the version (e.g. edited storage) never resolves to another question.
  assert.equal(s.entriesFor(pool, ['CL-ES-GOP-SGI-26#999']), null);
});

test('stored state holds no question text or answer key; damaged state is ignored', async () => {
  const s = await session();
  globalThis.sessionStorage = new MemoryStorage();
  const state = s.newQuizState(base, attempt, 1);
  s.saveQuizState('k', state);
  const stored = sessionStorage.getItem('k');
  assert.doesNotMatch(stored, /respuesta_correcta|pregunta"|opcion_/);
  for (const value of ['{broken', 'null', '{}', JSON.stringify({ ...state, keys: [] }), JSON.stringify({ ...state, actual: 9 }), JSON.stringify({ ...state, schema: 1 })]) {
    sessionStorage.setItem('k', value);
    assert.equal(s.readQuizState('k', '12345678'), null);
  }
  s.clearQuizState('k');
  assert.equal(sessionStorage.getItem('k'), null);
  delete globalThis.sessionStorage; // storage unavailable: never throws
  assert.equal(s.readQuizState('k', '12345678'), null);
});

test('a page prepared twice at once (React StrictMode) starts a single attempt', async () => {
  const s = await session();
  let starts = 0;
  const factory = async () => { starts++; await new Promise(done => setTimeout(done, 20)); return 'intento'; };
  const [a, b] = await Promise.all([s.preparing('k', factory), s.preparing('k', factory)]);
  assert.equal(a, b); assert.equal(starts, 1);
  await s.preparing('k', factory); // a later visit prepares again (it resumes from storage)
  assert.equal(starts, 2);
});
