import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { createResultsDb } from './helpers/results-db.mjs';
import { checkAttemptTime, GRACE_MS, SECONDS_PER_QUESTION } from '../server/attempt-clock.js';
import sessionEndpoint from '../api/session.js';
import { endpoint, allow } from '../server/http.js';
import { handleIntentos } from '../server/intentos.js';

// Same schema as the Neon test branch (see helpers/results-db.mjs). NOT a production migration.
let db, server, base;
process.env.SESSION_SECRET = 'test-secret-only-'.repeat(4);
process.env.ADMIN_PASSWORD = 'test-admin-password';
before(async () => {
  db = await createResultsDb();
  const routes = {
    '/api/session': sessionEndpoint,
    '/api/intentos': endpoint((req, res) => { allow(req, res, ['GET', 'POST']); return handleIntentos(req, db); }),
  };
  server = createServer((req, res) => routes[new URL(req.url, 'http://localhost').pathname](req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); await db.close(); });
async function request(path, { body, cookie, method, headers } = {}) {
  return fetch(base + '/api/' + path, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function login(body) {
  const response = await request('session', { body });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; SameSite=Strict/);
  return cookie.split(';')[0];
}
const attempt = {
  id: 'test-attempt', dni: '12345678', nombre: 'Participante de prueba', correo: 'test@example.com',
  unidad_negocio: 'Unidad', disciplina: 'Prueba', cargo: 'Prueba',
  estandar_codigo: 'SGI-03', estandar_nombre: 'Prueba', fecha: '2026-10-22T15:00:00Z',
  puntaje: 0, total_preguntas: 10, respuestas: [], tipo: 'USUARIO ANTIGUO', intento_num: 1,
};

// Starts an attempt on the server (id + signed time ticket), as the evaluation pages do.
async function start(cookie, dni = attempt.dni, total = attempt.total_preguntas, estandar = attempt.estandar_codigo) {
  const response = await request('intentos', { body: { accion: 'iniciar', dni, estandar_codigo: estandar, total_preguntas: total }, cookie });
  assert.equal(response.status, 200);
  return response.json();
}

test('session requires valid credentials and rejects forged/expired cookies', async () => {
  assert.equal((await request('session', { body: { password: 'wrong' } })).status, 401);
  assert.equal((await request('session', { body: { dni: 'x' } })).status, 400);
  assert.equal((await request('intentos')).status, 401);
  assert.equal((await request('intentos', { cookie: 'bisa_admin=forged.value' })).status, 401);
  const expired = Buffer.from(JSON.stringify({ role: 'admin', exp: 1 })).toString('base64url');
  const mac = createHmac('sha256', process.env.SESSION_SECRET).update(expired).digest('base64url');
  assert.equal((await request('intentos', { cookie: `bisa_admin=${expired}.${mac}` })).status, 401);
  const admin = await login({ password: process.env.ADMIN_PASSWORD });
  assert.deepEqual(await (await request('session', { cookie: admin })).json(), { admin: true });
  const response = await request('session', { method: 'DELETE', cookie: admin });
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
});
test('insert zero score, update final score, repeat id, preserve JSON, filter and isolate DNI', async () => {
  const cookie = await login({ dni: attempt.dni });
  const { id, ticket } = await start(cookie);
  const initial = { ...attempt, id };
  assert.equal((await request('intentos', { body: initial, cookie })).status, 200);
  const final = { ...initial, ticket, puntaje: 18, respuestas: [{ preguntaId: 1, esCorrecta: true }] };
  for (let i = 0; i < 2; i++) assert.equal((await request('intentos', { body: final, cookie })).status, 200);
  const response = await request('intentos?dni=12345678&estandar_codigo=SGI-03', { cookie });
  const rows = await response.json();
  assert.equal(rows.length, 1); assert.equal(Number(rows[0].puntaje), 18);
  assert.deepEqual(rows[0].respuestas, final.respuestas);
  assert.equal(rows[0].intento_num, 1); assert.equal(rows[0].tipo, attempt.tipo);
  assert.equal((await request('intentos', { cookie })).status, 401);
  assert.equal((await request('intentos?dni=87654321', { cookie })).status, 401);
  const other = await login({ dni: '87654321' });
  assert.equal((await request('intentos', { body: { ...initial, dni: '87654321' }, cookie: other })).status, 403);
  assert.equal((await request('intentos', { body: { accion: 'iniciar', dni: attempt.dni, total_preguntas: 10 }, cookie: other })).status, 401);
  const admin = await login({ password: process.env.ADMIN_PASSWORD });
  assert.equal((await (await request('intentos', { cookie: admin })).json()).length, 1);
});
test('a finished result is never overwritten: retries are idempotent, late initial saves are ignored', async () => {
  const cookie = await login({ dni: '11111111' });
  const { id, ticket } = await start(cookie, '11111111');
  const final = { ...attempt, dni: '11111111', id, ticket, puntaje: 14, respuestas: [{ preguntaId: 2, esCorrecta: true }] };
  assert.equal((await request('intentos', { body: final, cookie })).status, 200);
  // Network retry of the same result: accepted, no duplicate.
  assert.deepEqual(await (await request('intentos', { body: final, cookie })).json(), { ok: true, sinCambios: true });
  // An initial save delivered late (offline queue) must not reset the score to 0.
  assert.equal((await request('intentos', { body: { ...final, ticket: undefined, puntaje: 0, respuestas: [] }, cookie })).status, 200);
  // A different result for the same attempt is refused.
  const changed = await request('intentos', { body: { ...final, puntaje: 20 }, cookie });
  assert.equal(changed.status, 409); assert.equal((await changed.json()).code, 'RESULT_ALREADY_FINAL');
  const rows = await (await request('intentos?dni=11111111', { cookie })).json();
  assert.equal(rows.length, 1); assert.equal(rows[0].puntaje, 14); assert.deepEqual(rows[0].respuestas, final.respuestas);
  // A second attempt always has its own id and does not touch the first one.
  const second = await start(cookie, '11111111');
  assert.notEqual(second.id, id);
  assert.equal((await request('intentos', { body: { ...final, id: second.id, ticket: second.ticket, intento_num: 2, puntaje: 9 }, cookie })).status, 200);
  const both = await (await request('intentos?dni=11111111', { cookie })).json();
  assert.deepEqual(both.map(row => [row.id, row.puntaje]).sort(), [[id, 14], [second.id, 9]].sort());
});
test('final results need the signed ticket of the same attempt and must arrive within its time', async () => {
  const cookie = await login({ dni: '22222222' });
  const { id, ticket, inicio, limite } = await start(cookie, '22222222', 10);
  assert.equal(limite - inicio, 10 * SECONDS_PER_QUESTION * 1000);
  const final = { ...attempt, dni: '22222222', id, puntaje: 12, respuestas: [{ preguntaId: 3, esCorrecta: false }] };
  for (const forged of [undefined, 'x.y', ticket.replace(/.$/, ticket.endsWith('A') ? 'B' : 'A'), (await start(cookie, '22222222', 10)).ticket]) {
    const response = await request('intentos', { body: { ...final, ticket: forged }, cookie });
    assert.equal(response.status, 400); assert.equal((await response.json()).code, 'INVALID_ATTEMPT');
  }
  // Ticket fields cannot be edited: changing the question count invalidates it.
  assert.equal((await request('intentos', { body: { ...final, ticket, total_preguntas: 20 }, cookie })).status, 400);
  // Server clock decides: within limit + grace accepted, after it refused.
  const row = { ...final, ticket, total_preguntas: 10 };
  assert.doesNotThrow(() => checkAttemptTime(row, limite + GRACE_MS));
  assert.throws(() => checkAttemptTime(row, limite + GRACE_MS + 1), { status: 409, code: 'TIME_EXCEEDED' });
  assert.equal((await request('intentos', { body: row, cookie })).status, 200);
});
test('new intake score and snake_case response JSON remain unchanged', async () => {
  const cookie = await login({ dni: attempt.dni });
  const { id, ticket } = await start(cookie, attempt.dni, 20, 'EVALUACION-GLOBAL');
  const nuevo = { ...attempt, id, ticket, estandar_codigo: 'EVALUACION-GLOBAL', tipo: 'NUEVO INGRESO', total_preguntas: 20, puntaje: 14, respuestas: [{ pregunta: 'P', respuesta_usuario: 'A', respuesta_correcta: 'A', es_correcta: true }] };
  assert.equal((await request('intentos', { body: nuevo, cookie })).status, 200);
  const rows = await (await request('intentos?dni=12345678&estandar_codigo=EVALUACION-GLOBAL', { cookie })).json();
  assert.equal(Number(rows[0].puntaje), 14); assert.deepEqual(rows[0].respuestas, nuevo.respuestas);
});
test('SQL injection remains a parameter; invalid inputs, CSRF and methods are rejected', async () => {
  const cookie = await login({ dni: attempt.dni });
  const rows = await (await request('intentos?dni=12345678&estandar_codigo=' + encodeURIComponent("' OR 1=1; DROP TABLE intentos; --"), { cookie })).json();
  assert.deepEqual(rows, []);
  assert.equal((await request('intentos', { body: { ...attempt, puntaje: 99 }, cookie })).status, 400);
  assert.equal((await request('intentos', { body: attempt, cookie, headers: { Origin: 'https://foreign.example' } })).status, 403);
  assert.equal((await request('intentos', { method: 'DELETE', cookie })).status, 405);
  const response = await fetch(base + '/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
  assert.equal(response.status, 400);
  const nullBody = await fetch(base + '/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'null' });
  assert.equal(nullBody.status, 400);
});
test('at most two attempts per standard: the third is refused at start and on direct writes', async () => {
  const dni = '33333333', cookie = await login({ dni });
  const save = (id, extra = {}) => request('intentos', { body: { ...attempt, dni, id, ...extra }, cookie });
  // First and second attempts work normally; the server numbers them from the records.
  const first = await start(cookie, dni);
  assert.equal(first.intento_num, 1);
  assert.equal((await save(first.id)).status, 200);
  // A reload re-sends the same attempt: it never counts twice.
  for (let i = 0; i < 3; i++) assert.equal((await save(first.id)).status, 200);
  const second = await start(cookie, dni, 20);
  assert.equal(second.intento_num, 2);
  assert.equal((await save(second.id, { total_preguntas: 20, intento_num: 1 })).status, 200); // browser value ignored
  const rows = await (await request(`intentos?dni=${dni}`, { cookie })).json();
  assert.deepEqual(rows.map(row => row.intento_num).sort(), [1, 2]);
  // Third attempt: refused when starting...
  const third = await request('intentos', { body: { accion: 'iniciar', dni, estandar_codigo: attempt.estandar_codigo, total_preguntas: 10 }, cookie });
  assert.equal(third.status, 409); assert.equal((await third.json()).code, 'MAX_ATTEMPTS_REACHED');
  // ...and when writing directly, with or without an attempt id or ticket of its own.
  const direct = await save('intento-directo');
  assert.equal(direct.status, 409); assert.equal((await direct.json()).code, 'MAX_ATTEMPTS_REACHED');
  // An existing attempt cannot be moved to another standard to get more attempts there.
  const moved = await save(first.id, { estandar_codigo: 'SGI-04' });
  assert.equal(moved.status, 409); assert.equal((await moved.json()).code, 'ATTEMPT_MISMATCH');
  // Other standards are independent.
  assert.equal((await start(cookie, dni, 10, 'SGI-04')).intento_num, 1);
  assert.equal((await (await request(`intentos?dni=${dni}`, { cookie })).json()).length, 2);
});
test('simultaneous starts or writes cannot create a third attempt', async () => {
  const dni = '44444444', cookie = await login({ dni });
  const first = await start(cookie, dni);
  assert.equal((await request('intentos', { body: { ...attempt, dni, id: first.id }, cookie })).status, 200);
  // Two tabs both read "1 previous attempt" and write a new one at the same time.
  const results = await Promise.all(['pestana-a', 'pestana-b'].map(id => request('intentos', { body: { ...attempt, dni, id }, cookie })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal((await (await request(`intentos?dni=${dni}`, { cookie })).json()).length, 2);
});
test('the page announces which attempt it prepared; a stale number is refused, not silently changed', async () => {
  const dni = '55555555', cookie = await login({ dni });
  const ok = await request('intentos', { body: { accion: 'iniciar', dni, estandar_codigo: 'SGI-03', total_preguntas: 10, intento_num: 1 }, cookie });
  assert.equal(ok.status, 200);
  const stale = await request('intentos', { body: { accion: 'iniciar', dni, estandar_codigo: 'SGI-03', total_preguntas: 20, intento_num: 2 }, cookie });
  assert.equal(stale.status, 409); assert.equal((await stale.json()).code, 'ATTEMPT_COUNT_CHANGED');
});
test('Nuevo Ingreso: the global evaluation also allows two attempts per participant, counted on the server', async () => {
  const dni = '66666666', cookie = await login({ dni });
  for (const expected of [1, 2]) {
    const { id, ticket, intento_num } = await start(cookie, dni, 20, 'EVALUACION-GLOBAL');
    assert.equal(intento_num, expected);
    const body = { ...attempt, dni, id, ticket, estandar_codigo: 'EVALUACION-GLOBAL', tipo: 'NUEVO INGRESO', total_preguntas: 20, puntaje: 9, respuestas: [{ es_correcta: true }] };
    assert.equal((await request('intentos', { body, cookie })).status, 200);
  }
  const third = await request('intentos', { body: { accion: 'iniciar', dni, estandar_codigo: 'EVALUACION-GLOBAL', total_preguntas: 20 }, cookie });
  assert.equal(third.status, 409);
});
test('the retired /api/retake-approvals route no longer exists in the real routers (404, never a fake success)', async () => {
  const { createLocalApiServer } = await import('../scripts/dev.mjs');
  const { createDevelopmentServer } = await import('../scripts/dev-api.mjs');
  for (const app of [await createLocalApiServer({ db }), createDevelopmentServer()]) {
    await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${app.address().port}/api/retake-approvals?dni=12345678`;
    try {
      for (const init of [{}, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }]) {
        const response = await fetch(url, init);
        assert.equal(response.status, 404);
        assert.match((await response.json()).error, /Ruta API no encontrada/);
      }
      const health = await (await fetch(url.replace(/retake-approvals.*/, 'health'))).json();
      assert.equal((health.routes ?? []).includes('/api/retake-approvals'), false);
    } finally { await new Promise(resolve => app.close(resolve)); }
  }
});
