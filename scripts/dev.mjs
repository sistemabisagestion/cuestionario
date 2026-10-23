// `npm run dev`: local API and Vite in a single process, so one command starts and stops everything.
import { readFileSync, existsSync } from 'node:fs';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { createConnection } from 'node:net';
import { execFile } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { resolve as resolvePath } from 'node:path';
import { developmentServer, DEFAULT_API_PORT } from '../server/dev-router.js';
import { endpoint, HttpError } from '../server/http.js';
import { adminAuthConfigured } from '../server/auth.js';
import matrices from '../api/matrices.js';
import session from '../api/session.js';
import datos from '../api/datos.js';

export const DEFAULT_WEB_PORT = 5173;
// Neon branch verified for tests (scripts/test-neon.mjs). No other database is ever used locally.
const TEST_DATABASE_ENDPOINT = 'ep-nameless-hat-b5zjb2mk';
const TEST_CREDENTIAL_KEYS = ['ADMIN_PASSWORD', 'SESSION_SECRET', 'DATABASE_URL'];
// Identity of instances started from this installation. /api/health exposes a hash of the project
// path and a random secret; the same secret, the PID and the path are written to a file inside
// this project folder, so only a process started from here can match both.
export const PROJECT_ROOT = resolvePath(fileURLToPath(new URL('..', import.meta.url)));
export const PROJECT_INSTANCE = createHash('sha256').update(PROJECT_ROOT.toLowerCase()).digest('hex').slice(0, 16);
export const INSTANCE_DIR = join(PROJECT_ROOT, '.local-matrices', 'instancias');
const INSTANCE_SECRET = randomBytes(16).toString('hex');
const instanceFile = pid => join(INSTANCE_DIR, `${Number(pid)}.json`);

function readEnvFile(name) {
  try { return parseEnv(readFileSync(name, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}

// Same precedence as before: inherited variables > .env.matrices.local > .env.neon-test.local.
// Only the existing test credentials are taken from .env.neon-test.local; nothing is ever written back.
// Returns where each variable came from (names only, never values).
export function loadDevelopmentEnv(env = process.env) {
  const sources = {};
  const layers = [
    ['.env.neon-test.local', (credentials => Object.fromEntries(TEST_CREDENTIAL_KEYS.filter(key => key in credentials).map(key => [key, credentials[key]])))(readEnvFile('.env.neon-test.local'))],
    ['valor predeterminado', { MATRICES_STORAGE: 'local', MATRICES_LOCAL_DIR: '.local-matrices' }],
    ['.env.matrices.local', readEnvFile('.env.matrices.local')],
  ];
  for (const [, values] of layers) for (const key of Object.keys(values)) if (env[key] !== undefined && !(key in sources)) sources[key] = 'variable heredada del proceso';
  for (const [source, values] of layers) for (const [key, value] of Object.entries(values)) {
    if (sources[key] === 'variable heredada del proceso') continue;
    env[key] = value; sources[key] = source;
  }
  return sources;
}

export function isTestDatabase(url) {
  try {
    const host = new URL(url).hostname;
    return host.endsWith('.neon.tech') && host.split('.')[0].replace(/-pooler$/, '') === TEST_DATABASE_ENDPOINT;
  } catch { return false; }
}

// `db` (tests and the isolated browser check only): an in-memory database for results instead of Neon.
export async function createLocalApiServer({ results = false, db = null } = {}) {
  const unavailable = endpoint(() => {
    throw new HttpError(503, 'Resultados no disponibles en desarrollo local: no hay una base de pruebas Neon verificada en .env.neon-test.local.', 'RESULTS_UNAVAILABLE');
  });
  const routes = { '/api/matrices': matrices, '/api/datos': datos, '/api/session': session, '/api/intentos': unavailable };
  if (db) {
    const [{ handleIntentos }, { allow }] = await Promise.all([import('../server/intentos.js'), import('../server/http.js')]);
    routes['/api/intentos'] = endpoint((req, res) => { allow(req, res, ['GET', 'POST']); return handleIntentos(req, db); });
  } else if (results) {
    // Imported lazily so the database driver is only loaded when the test branch is confirmed.
    routes['/api/intentos'] = (await import('../api/intentos.js')).default;
  }
  return developmentServer(routes, 'bisaquiz-dev', { results: db ? 'memoria' : results ? 'neon-test' : 'disabled', instance: PROJECT_INSTANCE, pid: process.pid, secret: INSTANCE_SECRET, routes: Object.keys(routes) });
}

function accepts(host, port) {
  return new Promise(resolve => {
    const socket = createConnection({ host, port });
    const done = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(1000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}
// Vite listens on "localhost", which may resolve to IPv4 or IPv6; check both.
export async function portInUse(port) {
  return (await Promise.all([accepts('127.0.0.1', port), accepts('::1', port)])).some(Boolean);
}

function run(command, args) {
  return new Promise(resolve => execFile(command, args, { windowsHide: true, timeout: 5000 }, (error, stdout) => resolve(error ? '' : stdout)));
}
async function listeningProcess(port) {
  if (process.platform === 'win32') {
    const line = (await run('netstat', ['-ano', '-p', 'TCP'])).concat(await run('netstat', ['-ano', '-p', 'TCPv6']))
      .split(/\r?\n/).map(row => row.trim().split(/\s+/))
      .find(cols => cols[3] === 'LISTENING' && cols[1]?.endsWith(`:${port}`));
    const pid = line?.[4];
    if (!pid) return null;
    // pid comes from netstat and is numeric. Name, start time (UTC ms) and command line from CIM.
    const [name, created, ...command] = (await run('powershell', ['-NoProfile', '-Command',
      `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}"; "$($p.Name)|$(([DateTimeOffset]$p.CreationDate).ToUnixTimeMilliseconds())|$($p.CommandLine)"`])).trim().split('|');
    return { pid, name: name || 'desconocido', startedAt: Number(created) || null, command: command.join('|').trim() };
  }
  const pid = (await run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])).split('\n')[0].trim();
  if (!pid) return null;
  const started = Date.parse((await run('ps', ['-p', pid, '-o', 'lstart='])).trim());
  return { pid, name: (await run('ps', ['-p', pid, '-o', 'comm='])).trim() || 'desconocido', startedAt: Number.isFinite(started) ? started : null, command: (await run('ps', ['-p', pid, '-o', 'args='])).trim() };
}
async function health(port) {
  try {
    const response = await fetch(`http://localhost:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
    const body = await response.json();
    return typeof body?.service === 'string' && body.service.startsWith('bisaquiz') ? body : null;
  } catch { return null; }
}
async function bisaquizService(port) { return (await health(port))?.service ?? null; }

async function readInstanceFile(pid) {
  try { return JSON.parse(await readFile(instanceFile(pid), 'utf8')); } catch { return null; }
}
const DEV_SCRIPT = /(^|[\s"'\\/])scripts[\\/]dev\.mjs(["'\s]|$)/i;
// Why a process on `port` may (or may not) be stopped. It is an earlier `npm run dev` of THIS
// installation only if every check holds; otherwise it is left running and only reported.
export async function previousInstanceCheck(port) {
  const [body, owner] = await Promise.all([health(port), listeningProcess(port)]);
  if (!owner) return { pid: null, reason: 'no se identificó el proceso que usa el puerto' };
  const pid = Number(owner.pid);
  const record = await readInstanceFile(pid);
  const checks = [
    [pid !== process.pid, 'es este mismo proceso'],
    [/^node(\.exe)?$/i.test(owner.name), `el proceso es ${owner.name}, no Node.js`],
    [DEV_SCRIPT.test(owner.command), 'su comando no es scripts/dev.mjs'],
    [!!body && body.pid === pid, 'no responde como BISAQUIZ con su propio PID'],
    [body?.instance === PROJECT_INSTANCE, 'pertenece a otra instalación o a una versión sin identificador'],
    [!!record, `no existe ${instanceFile(pid)} en esta instalación`],
    [record?.pid === pid && record?.root === PROJECT_ROOT, 'el registro de esta instalación no corresponde a ese PID'],
    [!!body?.secret && record?.secret === body.secret, 'su secreto no coincide con el registrado en esta instalación'],
    // PID reuse: the recorded start time must match the operating system's.
    [!!owner.startedAt && Math.abs(owner.startedAt - record?.startedAt) < 10_000, 'su hora de inicio no coincide con el registro'],
  ];
  const failed = checks.find(([ok]) => !ok);
  return failed ? { pid: null, reason: failed[1] } : { pid, reason: null };
}
export async function previousInstancePid(port) { return (await previousInstanceCheck(port)).pid; }

async function stopPreviousInstances(ports) {
  const pids = [...new Set((await Promise.all(ports.map(previousInstancePid))).filter(Boolean))];
  for (const pid of pids) {
    try {
      process.kill(pid); // Windows: TerminateProcess; npm/cmd wrappers exit with it
      console.log(`Se detuvo la instancia anterior de BISAQUIZ de esta instalación (PID ${pid}, ${PROJECT_ROOT}) para iniciar la versión actual.`);
    } catch (error) { console.error(`No se pudo detener la instancia anterior (PID ${pid}): ${error.code ?? error.message}.`); }
  }
  for (let i = 0; pids.length && i < 50 && (await Promise.all(ports.map(portInUse))).some(Boolean); i++) await new Promise(done => setTimeout(done, 200));
  for (const pid of pids) await unlink(instanceFile(pid)).catch(() => {});
}
// Records of instances whose process no longer exists are removed.
async function removeStaleInstanceFiles() {
  for (const name of await readdir(INSTANCE_DIR).catch(() => [])) {
    const pid = Number(name.replace(/\.json$/, ''));
    if (!Number.isInteger(pid) || pid === process.pid) continue;
    try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') await unlink(join(INSTANCE_DIR, name)).catch(() => {}); }
  }
}

// Explains who holds the port. It never stops or signals any process.
export async function describeBusyPort(port, role) {
  const [owner, service] = await Promise.all([listeningProcess(port), bisaquizService(port)]);
  const who = owner ? `PID ${owner.pid}, ${owner.name}` : 'proceso no identificado';
  const lines = [`El puerto ${port} (${role}) ya está ocupado ${service ? `por una instancia anterior de BISAQUIZ (${service})` : 'por otro programa'} (${who}).`];
  if (owner?.command) lines.push(`  Comando: ${owner.command}`);
  if (service) {
    const { reason } = await previousInstanceCheck(port);
    if (reason) lines.push(`  No se detuvo automáticamente: ${reason}.`);
    lines.push(`  - Si sigue abierta otra terminal con npm run dev, usa esa instancia o deténla allí con Ctrl+C y vuelve a ejecutar npm run dev.`,
      '  - Una instancia iniciada antes de actualizar el código puede ejecutar una versión anterior: reiníciala.');
    if (owner) lines.push(`  - Si no encuentras esa terminal y confirmas que el proceso es tuyo: Stop-Process -Id ${owner.pid}`);
  } else {
    lines.push('  - Cierra ese programa o asigna otro puerto libre en .env.matrices.local (BISA_WEB_PORT para la web, BISA_API_PORT para la API).');
  }
  return lines.join('\n');
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.off('error', reject); resolve(); });
  });
}

export async function startDevelopment() {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') throw new Error('npm run dev es solo para desarrollo local.');
  const sources = loadDevelopmentEnv();
  if (process.env.MATRICES_STORAGE !== 'local') throw new Error('npm run dev requiere MATRICES_STORAGE=local (revisa .env.matrices.local).');
  const apiPort = Number(process.env.BISA_API_PORT || DEFAULT_API_PORT);
  const webPort = Number(process.env.BISA_WEB_PORT || DEFAULT_WEB_PORT);

  await removeStaleInstanceFiles();
  await stopPreviousInstances([webPort, apiPort]);
  const busy = [];
  for (const [port, role] of [[webPort, 'página web'], [apiPort, 'API local']]) {
    if (await portInUse(port)) busy.push(await describeBusyPort(port, role));
  }
  if (busy.length) {
    console.error(`\nBISAQUIZ no se inició. No se detuvo ningún otro proceso.\n\n${busy.join('\n\n')}\n`);
    process.exitCode = 1;
    return null;
  }

  const results = isTestDatabase(process.env.DATABASE_URL);
  if (!results) delete process.env.DATABASE_URL; // never fall back to another database
  const api = await createLocalApiServer({ results });
  await listen(api, apiPort, '127.0.0.1');
  process.env.BISA_API_PORT = String(apiPort); // read by the proxy in vite.config.ts

  const { createServer } = await import('vite');
  let vite;
  try {
    vite = await createServer({ configLoader: 'runner', server: { port: webPort, strictPort: true } });
    await vite.listen();
  } catch (error) {
    api.close();
    if (error.code === 'EADDRINUSE' || /already in use/i.test(error.message)) {
      console.error(`\nBISAQUIZ no se inició. No se detuvo ningún proceso.\n\n${await describeBusyPort(webPort, 'página web')}\n`);
      process.exitCode = 1;
      return null;
    }
    throw error;
  }

  // Proof of identity for a later `npm run dev` of this installation (see previousInstanceCheck).
  await mkdir(INSTANCE_DIR, { recursive: true });
  await writeFile(instanceFile(process.pid), JSON.stringify({ pid: process.pid, root: PROJECT_ROOT, secret: INSTANCE_SECRET, startedAt: Math.round(performance.timeOrigin), webPort, apiPort }));

  const dir = process.env.MATRICES_LOCAL_DIR;
  const missing = ['nuevo-ingreso', 'personal-antiguo'].filter(type => !existsSync(join(dir, `${type}.json`)));
  console.log(`\n  BISAQUIZ listo: http://localhost:${webPort}\n`);
  console.log(`  API local:        http://127.0.0.1:${apiPort} (mismo proceso; se detiene con Ctrl+C)`);
  console.log(`  Administración:   ${adminAuthConfigured() ? `configurada (contraseña desde ${sources.ADMIN_PASSWORD}; clave de sesión desde ${sources.SESSION_SECRET})` : 'NO configurada: falta ADMIN_PASSWORD o SESSION_SECRET (mín. 32 caracteres)'}`);
  console.log(`  Matrices:         ${dir}${missing.length ? ` — faltan ${missing.join(', ')}: ejecuta npm run matrices:recover` : ''}`);
  console.log(`  Resultados:       ${results ? 'rama de pruebas de Neon' : 'desactivados (sin base de pruebas verificada)'}\n`);

  const close = async () => {
    await vite.close().catch(() => {});
    if (api.listening) await new Promise(resolve => api.close(resolve));
    await unlink(instanceFile(process.pid)).catch(() => {});
  };
  let closing = false;
  const stop = () => { if (!closing) { closing = true; close().finally(() => process.exit(0)); } };
  // SIGHUP: the terminal window was closed. All three stop the web and the API together.
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(signal, stop);
  return { api, vite, apiPort, webPort, close: async () => { for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.off(signal, stop); await close(); } };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  startDevelopment().catch(error => {
    console.error(`\nBISAQUIZ no se inició: ${error.message}\n`);
    process.exitCode = 1;
  });
}
