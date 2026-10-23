import { randomBytes } from 'node:crypto';
import { HttpError } from './http.js';
import { equal, signature } from './auth.js';

// Server-side time limit of an evaluation. The browser cannot extend it: the attempt id and its
// start time are issued and signed here (SESSION_SECRET), and the final result is checked against
// this server's clock. No table changes: the ticket travels with the result and is not stored.
export const SECONDS_PER_QUESTION = 45;
// Covers reloads, slow networks and retries of a result saved while offline.
export const GRACE_MS = 10 * 60 * 1000;
export const MAX_QUESTIONS = 200;

// The ticket is bound to the participant, the evaluation (estandar_codigo) and its question count.
export function startAttempt(dni, estandarCodigo, total, now = Date.now()) {
  if (!Number.isInteger(total) || total < 1 || total > MAX_QUESTIONS) throw new HttpError(400, 'Cantidad de preguntas inválida.');
  const id = `${now.toString(36)}${randomBytes(6).toString('hex')}`;
  const payload = Buffer.from(JSON.stringify({ id, dni, est: estandarCodigo, total, inicio: now })).toString('base64url');
  return { id, ticket: `${payload}.${signature(payload)}`, inicio: now, limite: now + total * SECONDS_PER_QUESTION * 1000 };
}

// Final results must carry the ticket of the same attempt and arrive within its limit.
export function checkAttemptTime(row, now = Date.now()) {
  const [payload, mac] = typeof row.ticket === 'string' ? row.ticket.split('.') : [];
  let data = null;
  try { if (payload && mac && equal(mac, signature(payload))) data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { data = null; }
  if (!data || data.id !== row.id || data.dni !== row.dni || data.est !== row.estandar_codigo || data.total !== row.total_preguntas) {
    throw new HttpError(400, 'El resultado no corresponde a un intento iniciado en el servidor.', 'INVALID_ATTEMPT');
  }
  if (now > data.inicio + data.total * SECONDS_PER_QUESTION * 1000 + GRACE_MS) {
    throw new HttpError(409, 'El tiempo de la evaluación terminó antes de recibir el resultado; no se registró.', 'TIME_EXCEEDED');
  }
}
