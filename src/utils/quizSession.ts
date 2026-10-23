import type { Estandar, Pregunta } from '../types';

// State of an evaluation in progress, kept in this tab's sessionStorage so a reload resumes the
// same attempt: questions (by key, never their text or answer key), marked answers, position and
// the deadline of the current question. sessionStorage is per tab and is lost when the tab closes;
// another tab starts another attempt. Anyone can edit it, so it only guides the screen: the server
// ticket (server/attempt-clock.js) is what limits the total time of the attempt.
export const QUESTION_MS = 45_000;

export type QuizType = 'USUARIO ANTIGUO' | 'NUEVO INGRESO';
export interface QuizState {
  schema: 2;
  attemptId: string;
  ticket: string;
  dni: string;
  tipo: QuizType;
  cargo: string;
  estandares: string[];
  bankVersion: string;
  intentoNum: number;
  keys: string[];
  respuestas: Record<number, string>;
  actual: number;
  inicio: number;
  limite: number;
  vencePregunta: number;
  estado: 'en-curso' | 'finalizando';
}
export interface ServerAttempt { id: string; ticket: string; inicio: number; limite: number; intento_num: number }

// Question numbers repeat across standards (1..40 in each): the stable key is code + id.
export const questionKey = (codigo: string, id: number) => `${codigo}#${id}`;

export interface PoolEntry { key: string; pregunta: Pregunta; codigo: string; categoria: string }
export function questionPool(estandares: Estandar[]): PoolEntry[] {
  return estandares.flatMap(est => est.preguntas.map(pregunta => ({
    key: questionKey(est.estandar_codigo, pregunta.id), pregunta, codigo: est.estandar_codigo, categoria: est.estandar_nombre || est.estandar_codigo,
  })));
}
export function drawKeys(pool: PoolEntry[], count: number, random = Math.random): string[] {
  const keys = pool.map(entry => entry.key);
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return keys.slice(0, Math.min(count, keys.length));
}
// Questions of a stored attempt, from the exact bank version it started with.
export function entriesFor(pool: PoolEntry[], keys: string[]): PoolEntry[] | null {
  const byKey = new Map(pool.map(entry => [entry.key, entry]));
  const entries = keys.map(key => byKey.get(key));
  return entries.every(Boolean) ? entries as PoolEntry[] : null;
}

export function newQuizState(base: Omit<QuizState, 'schema' | 'attemptId' | 'ticket' | 'respuestas' | 'actual' | 'inicio' | 'limite' | 'vencePregunta' | 'estado'>, attempt: ServerAttempt, now = Date.now()): QuizState {
  return {
    schema: 2, ...base, attemptId: attempt.id, ticket: attempt.ticket, respuestas: {}, actual: 0,
    inicio: now, limite: now + base.keys.length * QUESTION_MS, vencePregunta: now + QUESTION_MS, estado: 'en-curso',
  };
}

// Applies elapsed time after a reload. Deadlines can never grow beyond one full question from now,
// the schedule from the start or the overall limit, so editing the stored values gains nothing.
// Questions whose time ran out while away are returned as expired, as if their timer had ended.
export function resumeQuiz(state: QuizState, now = Date.now()): { state: QuizState; expired: number[]; finished: boolean } {
  const total = state.keys.length;
  let actual = state.actual;
  let deadline = Math.min(state.vencePregunta, now + QUESTION_MS, state.inicio + (actual + 1) * QUESTION_MS, state.limite);
  const expired: number[] = [];
  while (actual < total && now >= deadline) {
    expired.push(actual);
    actual++;
    deadline = Math.min(deadline + QUESTION_MS, state.limite);
  }
  return { state: { ...state, actual: Math.min(actual, total - 1), vencePregunta: deadline }, expired, finished: actual >= total || state.estado === 'finalizando' };
}
export function remainingSeconds(state: Pick<QuizState, 'vencePregunta'>, now = Date.now()): number {
  return Math.max(0, Math.min(QUESTION_MS / 1000, Math.ceil((state.vencePregunta - now) / 1000)));
}

const isState = (value: unknown, dni: string): value is QuizState => {
  const v = value as QuizState;
  return !!v && v.schema === 2 && v.dni === dni && typeof v.attemptId === 'string' && !!v.attemptId && typeof v.ticket === 'string'
    && typeof v.bankVersion === 'string' && Array.isArray(v.keys) && v.keys.length > 0 && v.keys.every(key => typeof key === 'string')
    && Number.isInteger(v.actual) && v.actual >= 0 && v.actual < v.keys.length && !!v.respuestas && typeof v.respuestas === 'object'
    && [v.inicio, v.limite, v.vencePregunta].every(Number.isFinite) && (v.estado === 'en-curso' || v.estado === 'finalizando');
};
// Only the same participant's state is ever resumed.
export function readQuizState(key: string, dni: string): QuizState | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    return isState(value, dni) ? value : null;
  } catch { return null; }
}
export function saveQuizState(key: string, state: QuizState): void {
  try { sessionStorage.setItem(key, JSON.stringify(state)); }
  catch { /* storage unavailable: the attempt continues, it just cannot be resumed */ }
}
export function clearQuizState(key: string): void {
  try { sessionStorage.removeItem(key); } catch { /* nothing to clear */ }
}

// One preparation per attempt at a time: React StrictMode runs effects twice in development, and
// starting twice would create two attempts on the server.
const inFlight = new Map<string, Promise<unknown>>();
export function preparing<T>(key: string, factory: () => Promise<T>): Promise<T> {
  if (!inFlight.has(key)) inFlight.set(key, factory().finally(() => inFlight.delete(key)));
  return inFlight.get(key) as Promise<T>;
}
