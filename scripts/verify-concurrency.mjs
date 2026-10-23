// Two-attempt limit under real concurrency, on a TEMPORARY PostgreSQL server created for this run
// (initdb + pg_ctl in a temporary folder, own port, 127.0.0.1 only) and deleted afterwards. It never
// connects to Neon nor to an existing PostgreSQL service. The API runs with pg.Pool, the same
// code path used with Neon (BEGIN + pg_advisory_xact_lock + count + insert, then COMMIT).
//   npm run test:concurrencia            (PG_BIN=<carpeta bin de PostgreSQL> si no es la ruta por defecto)
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import pg from 'pg';
import { createLocalApiServer } from './dev.mjs';
import { INTENTOS_DDL } from '../tests/helpers/results-db.mjs';

const BIN = process.env.PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
const exe = name => join(BIN, process.platform === 'win32' ? `${name}.exe` : name);
if (!existsSync(exe('initdb')) || !existsSync(exe('pg_ctl'))) {
  console.error(`No hay binarios de PostgreSQL en ${BIN} (define PG_BIN). No se probó nada sobre bases existentes.`);
  process.exit(2);
}
const report = [];
const check = (name, ok, detail = '') => { report.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'OK ' : 'ERR'} ${name}${detail ? ` — ${detail}` : ''}`); };
const freePort = () => new Promise(done => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => done(port)); }); });
const sleep = ms => new Promise(done => setTimeout(done, ms));

// ── Temporary, isolated PostgreSQL ──
const dir = await mkdtemp(join(tmpdir(), 'bisa-pg-concurrencia-'));
const data = join(dir, 'data');
const port = await freePort();
execFileSync(exe('initdb'), ['-D', data, '-U', 'bisa_prueba', '-A', 'trust', '-E', 'UTF8', '--no-locale'], { stdio: 'ignore' });
execFileSync(exe('pg_ctl'), ['-D', data, '-l', join(dir, 'postgres.log'), '-o', `-p ${port} -c listen_addresses=127.0.0.1 -c max_connections=60`, '-w', 'start'], { stdio: 'ignore' });

Object.assign(process.env, { SESSION_SECRET: 'concurrency-fixture-secret-'.repeat(2), ADMIN_PASSWORD: 'concurrency-fixture-only', MATRICES_STORAGE: 'local', MATRICES_LOCAL_DIR: dir });
delete process.env.DATABASE_URL;
// Same pool size as production (server/db.js uses max 5) plus a larger one, to vary contention.
const pools = [];
let api;
try {
  const admin = new pg.Client({ host: '127.0.0.1', port, user: 'bisa_prueba', database: 'postgres' });
  await admin.connect();
  const where = (await admin.query('SHOW data_directory')).rows[0].data_directory;
  const version = (await admin.query('SHOW server_version')).rows[0].server_version;
  check('Servidor PostgreSQL temporal y aislado', resolve(where).toLowerCase() === resolve(data).toLowerCase(), `PostgreSQL ${version}, puerto ${port}, ${where}`);
  await admin.query(INTENTOS_DDL);
  await admin.end();

  for (const max of [5, 20]) {
    const pool = new pg.Pool({ host: '127.0.0.1', port, user: 'bisa_prueba', database: 'postgres', max });
    pools.push(pool);
    api?.close();
    api = await createLocalApiServer({ db: pool });
    await new Promise(done => api.listen(0, '127.0.0.1', done));
    const base = `http://127.0.0.1:${api.address().port}`;
    const label = `pool de ${max} conexiones`;

    const sessions = new Map();
    async function session(dni) {
      if (!sessions.has(dni)) {
        const response = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dni }) });
        sessions.set(dni, response.headers.get('set-cookie').split(';')[0]);
      }
      return sessions.get(dni);
    }
    async function post(dni, body) {
      const response = await fetch(`${base}/api/intentos`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: await session(dni) }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    }
    const row = (dni, est, id, extra = {}) => ({
      id, dni, nombre: 'Prueba', cargo: 'Cargo', estandar_codigo: est, estandar_nombre: 'Estándar', fecha: new Date().toISOString(),
      puntaje: 0, total_preguntas: 10, respuestas: [], tipo: est === 'EVALUACION-GLOBAL' ? 'NUEVO INGRESO' : 'USUARIO ANTIGUO', intento_num: 1, ...extra,
    });
    // One browser tab: the server starts the attempt, then the page saves it (initial score 0).
    async function tab(dni, est) {
      const start = await post(dni, { accion: 'iniciar', dni, estandar_codigo: est, total_preguntas: 10 });
      if (start.status !== 200) return { stage: 'inicio', ...start };
      const saved = await post(dni, row(dni, est, start.body.id));
      return { stage: 'guardado', ...saved, attempt: start.body };
    }
    const rowsOf = async (dni, est) => (await pool.query('SELECT id, intento_num, puntaje, respuestas FROM public.intentos WHERE dni = $1 AND estandar_codigo = $2 ORDER BY intento_num', [dni, est])).rows;
    let seq = 0;
    const newDni = () => String(10_000_000 + Number(`${max}`) * 1_000_000 + (++seq)).slice(-8);

    // 1. Two tabs of the same worker and standard, with one attempt already done: only one more.
    {
      const dni = newDni(), est = 'CL-ES-GOP-SGI-03';
      const first = await tab(dni, est);
      const both = await Promise.all([tab(dni, est), tab(dni, est)]);
      const ok = both.filter(r => r.stage === 'guardado' && r.status === 200).length;
      const refused = both.filter(r => r.status === 409 && r.body.code === 'MAX_ATTEMPTS_REACHED').length;
      const rows = await rowsOf(dni, est);
      check(`Dos pestañas simultáneas con 1 intento previo: solo se crea uno (${label})`, first.status === 200 && ok === 1 && refused === 1 && rows.length === 2
        && JSON.stringify(rows.map(r => r.intento_num)) === '[1,2]', `estados ${both.map(r => `${r.stage}:${r.status}`).join(', ')}`);
    }

    // 2. Bursts of 12 simultaneous tabs from zero attempts, repeated: always exactly 2, numbered 1 and 2.
    {
      let worst = 0, bad = [];
      for (let round = 0; round < 25; round++) {
        const dni = newDni(), est = round % 2 ? 'EVALUACION-GLOBAL' : 'CL-ES-GOP-SGI-26';
        const results = await Promise.all(Array.from({ length: 12 }, () => tab(dni, est)));
        const rows = await rowsOf(dni, est);
        worst = Math.max(worst, rows.length);
        const others = results.filter(r => !(r.status === 200 || (r.status === 409 && r.body.code === 'MAX_ATTEMPTS_REACHED')));
        if (rows.length !== 2 || JSON.stringify(rows.map(r => r.intento_num)) !== '[1,2]' || others.length) bad.push({ round, rows: rows.length, others: others.map(o => o.status) });
      }
      check(`25 ráfagas de 12 pestañas simultáneas: siempre 2 intentos (1 y 2), nunca 3 (${label})`, bad.length === 0, `máximo observado: ${worst}${bad.length ? `; fallos ${JSON.stringify(bad.slice(0, 3))}` : ''}`);
    }

    // 3. Final results sent at the same time: retries are idempotent, a different result never overwrites.
    {
      const dni = newDni(), est = 'CL-ES-GOP-SGI-27';
      const tabs = await Promise.all([tab(dni, est), tab(dni, est)]);
      const finals = tabs.map((t, i) => row(dni, est, t.attempt.id, { ticket: t.attempt.ticket, puntaje: 10 + i, respuestas: [{ preguntaId: 1, esCorrecta: true }] }));
      const sends = await Promise.all([
        ...finals.flatMap(f => Array.from({ length: 5 }, () => post(dni, f))), // network retries
        ...finals.map(f => post(dni, { ...f, puntaje: 20 })), // a different result for the same attempt
        ...finals.map(f => post(dni, { ...f, ticket: undefined, puntaje: 0, respuestas: [] })), // late initial save
      ]);
      const rows = await rowsOf(dni, est);
      const stored = rows.map(r => r.puntaje);
      const unexpected = sends.filter(s => !(s.status === 200 || (s.status === 409 && s.body.code === 'RESULT_ALREADY_FINAL')));
      // For each attempt exactly one final result is stored, and it is one of those actually sent.
      const coherent = rows.length === 2 && rows.every((r, i) => r.respuestas.length === 1 && [10 + i, 20].includes(r.puntaje));
      const conflictsRefused = sends.slice(10, 12).every(s => s.status === 409 || s.status === 200);
      check(`Guardados finales simultáneos: sin duplicados ni sobrescrituras (${label})`, coherent && conflictsRefused && unexpected.length === 0,
        `filas ${rows.length}, puntajes guardados ${JSON.stringify(stored)}, respuestas ${sends.map(s => s.status).join(' ')}`);
      // Once final, a later different result is always refused.
      const late = await post(dni, { ...finals[0], puntaje: rows[0].puntaje === 20 ? 5 : 20 });
      check(`Un resultado final no se reemplaza después (${label})`, late.status === 409 && late.body.code === 'RESULT_ALREADY_FINAL');
    }

    // 4. Different workers and standards at the same time: all accepted, none waits for another.
    {
      const workers = Array.from({ length: 15 }, newDni), standards = ['CL-ES-GOP-SGI-03', 'CL-ES-GOP-SGI-04', 'EVALUACION-GLOBAL'];
      const startTime = Date.now();
      const results = await Promise.all(workers.flatMap(dni => standards.flatMap(est => [tab(dni, est), tab(dni, est)])));
      const elapsed = Date.now() - startTime;
      const counts = (await pool.query(`SELECT dni, estandar_codigo, count(*)::int n FROM public.intentos WHERE dni = ANY($1) GROUP BY 1, 2`, [workers])).rows;
      check(`90 pestañas de 15 trabajadores × 3 evaluaciones a la vez: todas aceptadas (${label})`, results.every(r => r.status === 200) && counts.length === 45 && counts.every(c => c.n === 2), `${elapsed} ms`);
    }

    // 5. Lock granularity: while one worker+standard is locked, others proceed; then it continues.
    {
      const blocked = newDni(), other = newDni();
      const holder = await pool.connect();
      await holder.query('BEGIN');
      await holder.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`intentos|${blocked}|CL-ES-GOP-SGI-05`]);
      let waitingDone = false;
      const waiting = tab(blocked, 'CL-ES-GOP-SGI-05').then(r => { waitingDone = true; return r; });
      const t0 = Date.now();
      const free = await Promise.all([tab(blocked, 'CL-ES-GOP-SGI-06'), tab(other, 'CL-ES-GOP-SGI-05')]);
      const freeMs = Date.now() - t0;
      await sleep(300);
      const stillWaiting = !waitingDone;
      await holder.query('COMMIT');
      holder.release();
      const resumed = await waiting;
      check(`Bloqueo por trabajador y evaluación: los demás no esperan (${label})`, free.every(r => r.status === 200) && stillWaiting && resumed.status === 200,
        `otros completados en ${freeMs} ms mientras el bloqueado esperaba; luego continuó (${resumed.status})`);
    }

    // Global invariants for everything written in this pool's run.
    const over = (await pool.query('SELECT dni, estandar_codigo, count(*)::int n FROM public.intentos GROUP BY 1, 2 HAVING count(*) > 2')).rows;
    const dupNums = (await pool.query('SELECT dni, estandar_codigo, intento_num FROM public.intentos GROUP BY 1, 2, 3 HAVING count(*) > 1')).rows;
    check(`Ningún trabajador/evaluación supera 2 intentos ni repite número de intento (${label})`, over.length === 0 && dupNums.length === 0, `${(await pool.query('SELECT count(*)::int n FROM public.intentos')).rows[0].n} intentos en total`);
  }
} catch (error) {
  check('Ejecución', false, error.stack ?? error.message);
} finally {
  api?.close();
  for (const pool of pools) await pool.end().catch(() => {});
  try { execFileSync(exe('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' }); } catch { /* already stopped */ }
  await rm(dir, { recursive: true, force: true }).catch(() => {});
  check('Servidor temporal detenido y eliminado', !existsSync(dir));
}
const failed = report.filter(r => !r.ok).length;
console.log(`\n${report.length - failed}/${report.length} comprobaciones aprobadas`);
process.exit(failed ? 1 : 0);
