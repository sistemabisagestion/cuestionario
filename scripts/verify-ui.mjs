// End-to-end check in a real browser (headless Edge/Chrome via the DevTools protocol).
// It starts its OWN isolated instance: the real API and Vite, results in an in-memory PostgreSQL
// with the Neon test schema, and a temporary copy of the matrices. Nothing is written to Neon,
// to .local-matrices or to any running BISAQUIZ.
//   node scripts/verify-ui.mjs [directorio-salida]
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { createServer as createVite } from 'vite';
import { createLocalApiServer, loadDevelopmentEnv } from './dev.mjs';
import { createResultsDb } from '../tests/helpers/results-db.mjs';
import { tableWorkbook } from '../shared/excel-tables.mjs';
import { DATASETS, toRows } from '../shared/datasets.mjs';

const OUT = resolve(process.argv[2] ?? join(tmpdir(), `bisa-verificacion-ui-${Date.now()}`));
const sleep = ms => new Promise(done => setTimeout(done, ms));
const sha = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const report = [];
const check = (name, ok, detail = '') => { report.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'OK ' : 'ERR'} ${name}${detail ? ` — ${detail}` : ''}`); };

// ── Isolated instance ──
await mkdir(join(OUT, 'downloads'), { recursive: true });
const originals = ['nuevo-ingreso', 'personal-antiguo'].map(type => join('.local-matrices', `${type}.json`));
const originalHashes = await Promise.all(originals.map(sha));
const dataDir = await mkdtemp(join(tmpdir(), 'bisa-ui-datos-'));
for (const file of originals) await copyFile(file, join(dataDir, file.split(/[\\/]/).pop()));
loadDevelopmentEnv(); // existing development credentials; results go to memory, never to DATABASE_URL
delete process.env.DATABASE_URL;
Object.assign(process.env, { MATRICES_STORAGE: 'local', MATRICES_LOCAL_DIR: dataDir });
const db = await createResultsDb();
const apiServer = await createLocalApiServer({ db });
await new Promise(done => apiServer.listen(0, '127.0.0.1', done));
process.env.BISA_API_PORT = String(apiServer.address().port);
const vite = await createVite({ configLoader: 'runner', logLevel: 'error', server: { port: 0, host: 'localhost' } });
await vite.listen();
const BASE = `http://localhost:${vite.httpServer.address().port}`;

// ── Node-side API client (setup and verification only) ──
const login = await fetch(`${BASE}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE }, body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }) });
const cookie = login.headers.get('set-cookie').split(';')[0];
const api = async (path, body) => (await fetch(`${BASE}/api/${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: BASE }, body: JSON.stringify(body) } : { headers: { Cookie: cookie } })).json();
const current = module => api(`datos?module=${module}`);
const rowsOf = async dni => (await db.query('SELECT id, puntaje, intento_num, tipo, total_preguntas, respuestas FROM public.intentos WHERE dni = $1 ORDER BY intento_num, id', [dni])).rows;
async function xlsx(module, rows, name) {
  const path = join(OUT, name);
  await writeFile(path, Buffer.from(await tableWorkbook(ExcelJS, DATASETS[module], rows)));
  return path;
}
async function publishRows(module, rows) {
  const base = (await current(module)).version;
  const file = { name: 'cambio.xlsx', base64: Buffer.from(await tableWorkbook(ExcelJS, DATASETS[module], rows)).toString('base64') };
  return api('datos', { module, action: 'publish', mode: 'parcial', base, file });
}

// ── Browser ──
const browserPath = [process.env.BROWSER_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .find(path => path && existsSync(path));
if (!browserPath) throw new Error('No se encontró Edge ni Chrome; define BROWSER_PATH.');
const profile = await mkdtemp(join(tmpdir(), 'bisa-ui-perfil-'));
const browser = spawn(browserPath, ['--headless=new', '--remote-debugging-port=9341', `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
let version;
for (let i = 0; i < 50 && !version; i++) { try { version = await (await fetch('http://127.0.0.1:9341/json/version')).json(); } catch { await sleep(200); } }
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise(done => ws.addEventListener('open', done, { once: true }));
let seq = 0; const pending = new Map(); const exceptions = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve: ok, reject } = pending.get(message.id); pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : ok(message.result);
  } else if (message.method === 'Page.javascriptDialogOpening') {
    // Accept confirm() and the beforeunload prompt shown when reloading an evaluation.
    void send('Page.handleJavaScriptDialog', { accept: true }, message.sessionId);
  } else if (message.method === 'Runtime.exceptionThrown') {
    exceptions.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  }
});
function send(method, params = {}, sessionId) {
  return new Promise((ok, reject) => { const id = ++seq; pending.set(id, { resolve: ok, reject }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
}
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, S);
await send('Runtime.enable', {}, S);
await send('Network.enable', {}, S);
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1800, deviceScaleFactor: 1, mobile: false }, S);
await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: join(OUT, 'downloads'), eventsEnabled: true });

async function js(body) {
  const result = await send('Runtime.evaluate', { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }, S);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression, label, ms = 20000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try { if (await js(`return !!(${expression});`)) return; } catch { /* page navigating */ }
    await sleep(200);
  }
  throw new Error(`Tiempo agotado esperando: ${label}`);
}
async function go(path) { await send('Page.navigate', { url: BASE + path }, S); await sleep(300); await waitFor(`document.readyState === 'complete'`, 'carga'); }
async function reload() { await send('Page.reload', {}, S); await sleep(600); await waitFor(`document.readyState === 'complete'`, 'recarga'); }
async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, S);
  await writeFile(join(OUT, name), Buffer.from(data, 'base64'));
}
const offline = value => send('Network.emulateNetworkConditions', { offline: value, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, S);
// In-page helpers: React-controlled inputs, cards by title, buttons by label.
const helpers = `
  const setValue = (el, value) => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  };
  const byPlaceholder = text => document.querySelector('input[placeholder="' + text + '"]');
  const card = title => [...document.querySelectorAll('h3')].find(h => h.textContent.trim() === title)?.parentElement?.parentElement;
  const buttons = el => [...el.querySelectorAll('button')];
  const byLabel = (el, label) => buttons(el).find(b => b.textContent.includes(label));
  const button = label => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label || b.textContent.includes(label));
  const questionText = () => document.querySelector('.question-card__text')?.textContent;
`;
async function setFile(title, path) {
  await js(`${helpers} card(${JSON.stringify(title)}).querySelector('input[type=file]').setAttribute('data-upload', 'x');`);
  const { root } = await send('DOM.getDocument', {}, S);
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-upload="x"]' }, S);
  await send('DOM.setFileInputFiles', { files: [path], nodeId }, S);
  await js(`document.querySelector('[data-upload="x"]').removeAttribute('data-upload');`);
}
const cardText = title => js(`${helpers} return card(${JSON.stringify(title)}).innerText;`);
const clickIn = (title, label, last = false) => js(`${helpers} const list = buttons(card(${JSON.stringify(title)})).filter(b => b.textContent.includes(${JSON.stringify(label)})); const b = ${last ? 'list.at(-1)' : 'list[0]'}; if (!b) throw new Error('no button ${label}'); b.click();`);
const disabled = (title, label) => js(`${helpers} return byLabel(card(${JSON.stringify(title)}), ${JSON.stringify(label)}).disabled;`);
const quizState = key => js(`return JSON.parse(sessionStorage.getItem(${JSON.stringify(key)}));`);
const shownSeconds = () => js(`return Number(document.body.innerText.match(/⏱ (\\d+)s|(\\d+) segundos/)?.slice(1).find(Boolean));`);
const pick = letter => js(`${helpers} [...document.querySelectorAll('.option-btn')].find(b => b.querySelector('.option-btn__letter')?.textContent === '${letter}').click();`);
const selectedLetter = () => js(`return document.querySelector('.option-btn--selected .option-btn__letter')?.textContent ?? null;`);

const TITLES = ['Resultados de Evaluaciones', 'Banco de Preguntas', 'Links de Estándares', 'Matriz de Nuevo Ingreso', 'Matriz de Personal Antiguo'];
try {
  // ── 1. Inicio ──
  await go('/');
  await waitFor(`document.body.innerText.includes('Evaluación de Estándares de Gestión')`, 'inicio');
  check('Inicio de BISAQUIZ (web + API en un proceso)', (await (await fetch(`${BASE}/api/health`)).json()).results === 'memoria');

  // ── 2. Registro de participante (Personal Antiguo) por el formulario real ──
  const dni = '87654321', code = 'CL-ES-GOP-SGI-26', key = `bisa-quiz-attempt-${dni}-${code}`;
  await go('/register');
  await waitFor(`document.querySelector('input[placeholder="Buscar o seleccionar cargo..."]')`, 'formulario');
  await js(`${helpers}
    setValue(byPlaceholder('Juan Pérez García'), 'Participante de prueba');
    const selects = document.querySelectorAll('select');
    setValue(selects[0], selects[0].options[1].value); setValue(selects[1], selects[1].options[1].value);
    setValue(byPlaceholder('jperez@bisa.com.pe'), 'prueba@example.com');
    setValue(byPlaceholder('12345678'), '${dni}');
    byPlaceholder('Buscar o seleccionar cargo...').dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    byPlaceholder('Buscar o seleccionar cargo...').focus();`);
  await waitFor(`[...document.querySelectorAll('li')].some(li => li.textContent.trim() === 'Ayudante')`, 'lista de cargos');
  await js(`[...document.querySelectorAll('li')].find(li => li.textContent.trim() === 'Ayudante').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));`);
  await sleep(200);
  await js(`document.querySelector('form').requestSubmit();`);
  await waitFor(`location.pathname === '/standards' && document.body.innerText.includes('asignados a: Ayudante')`, 'listado de estándares');
  check('Registro de participante (Personal Antiguo) por formulario', true, await js(`return document.querySelector('.page-subtitle')?.textContent;`));

  // ── 3. Evaluación Personal Antiguo: respuestas, recarga, temporizador, publicación intermedia ──
  await go(`/quiz/${code}`);
  await waitFor(`document.querySelector('.question-card__text')`, 'pregunta 1');
  await pick('B');
  await js(`${helpers} button('Siguiente').click();`);
  await waitFor(`document.body.innerText.includes('Pregunta 2 de 10')`, 'pregunta 2');
  await pick('C');
  await sleep(5000);
  const before = await quizState(key);
  const textBefore = await js(`${helpers} return questionText();`);
  const secondsBefore = await shownSeconds();
  const serverAtStart = await rowsOf(dni);
  check('Intento iniciado en el servidor con id propio (guardado inicial 0)', serverAtStart.length === 1 && serverAtStart[0].id === before.attemptId && serverAtStart[0].puntaje === 0, before.attemptId);
  const v2 = await publishRows('preguntas', toRows('preguntas', (await current('preguntas')).data).filter(r => r.codigo === code).map(r => ({ ...r, pregunta: `[v2] ${r.pregunta}` })));
  await sleep(3000); // the clock keeps running while the page reloads
  await reload();
  await waitFor(`document.querySelector('.question-card__text')`, 'pregunta tras recargar');
  const after = await quizState(key);
  const secondsAfter = await shownSeconds();
  check('Recarga: mismo intento, versión, preguntas y posición', after.attemptId === before.attemptId && after.bankVersion === before.bankVersion && JSON.stringify(after.keys) === JSON.stringify(before.keys)
    && await js(`return document.body.innerText.includes('Pregunta 2 de 10');`) && await js(`${helpers} return questionText();`) === textBefore && !textBefore.startsWith('[v2]'), `versión ${after.bankVersion}; publicada mientras tanto ${v2.version}`);
  check('Recarga: respuestas marcadas conservadas', JSON.stringify(after.respuestas) === JSON.stringify({ 0: 'B', 1: 'C' }) && await selectedLetter() === 'C');
  check('Recarga: el temporizador continúa (no vuelve a 45 s)', secondsAfter <= secondsBefore - 2 && secondsAfter >= secondsBefore - 8, `${secondsBefore}s antes, 3 s de espera y recarga, ${secondsAfter}s después`);
  check('El almacenamiento del navegador no guarda textos ni respuestas correctas', !/respuesta_correcta|opcion_a|"pregunta"/.test(await js(`return sessionStorage.getItem(${JSON.stringify(key)});`)));
  // Tampering: a deadline one hour ahead does not give more time after a reload.
  await js(`const s = JSON.parse(sessionStorage.getItem(${JSON.stringify(key)})); s.vencePregunta = Date.now() + 3600000; s.inicio = Date.now() + 3600000; sessionStorage.setItem(${JSON.stringify(key)}, JSON.stringify(s));`);
  await reload();
  await waitFor(`document.querySelector('.question-card__text')`, 'pregunta tras manipular');
  const tamperedSeconds = await shownSeconds();
  check('Manipular el navegador no da más de 45 s por pregunta (el total lo limita el servidor)', tamperedSeconds <= 45, `${tamperedSeconds}s`);
  // Answer the rest and finish offline: result kept locally and sent once online, without duplicates.
  for (let i = 0; i < 12 && !(await js(`${helpers} return !!button('Finalizar') && !button('Siguiente');`)); i++) { await pick('A'); await js(`${helpers} button('Siguiente')?.click();`); await sleep(150); }
  await pick('A');
  await offline(true);
  await js(`${helpers} const f = button('Finalizar'); f.click(); f.click();`); // double click
  await waitFor(`location.pathname.startsWith('/results/')`, 'resultado');
  const queued = await js(`return JSON.parse(localStorage.getItem('bisa-neon-pending') || '[]').map(i => i.id);`);
  check('Sin red: el resultado queda guardado y en cola (no se pierde)', queued.length === 1 && queued[0] === before.attemptId && (await rowsOf(dni))[0].puntaje === 0, JSON.stringify(queued));
  check('Visualización del resultado (Personal Antiguo)', await js(`return /\\d+\\s*de 20 puntos/.test(document.body.innerText) && document.body.innerText.includes('Detalle de respuestas');`),
    await js(`return document.body.innerText.match(/\\d+\\s*de 20 puntos/)?.[0];`));
  check('Resultado del 1.er intento: «Repetir estándar» disponible; sin «Pendiente de aprobación»', await js(`return document.body.innerText.includes('Repetir estándar') && !document.body.innerText.includes('Pendiente de aprobación');`));
  await shot('1-resultado-personal-antiguo.png');
  await offline(false);
  await js(`window.dispatchEvent(new Event('online'));`);
  for (let i = 0; i < 50 && (await rowsOf(dni))[0]?.respuestas.length !== 10; i++) await sleep(200);
  const finalRows = await rowsOf(dni);
  check('Con red: se envía una sola vez con el mismo id (doble clic y reintento idempotentes)', finalRows.length === 1 && finalRows[0].id === before.attemptId && finalRows[0].respuestas.length === 10, `puntaje ${finalRows[0].puntaje}`);
  check('Al finalizar se libera la evaluación', await js(`return sessionStorage.getItem(${JSON.stringify(key)}) === null && JSON.parse(localStorage.getItem('bisa-neon-pending') || '[]').length === 0;`));

  // Second attempt: new id, current version, attempt 2, 20 questions; first result untouched.
  await go(`/quiz/${code}`);
  await waitFor(`document.querySelector('.question-card__text')`, 'segundo intento');
  const second = await quizState(key);
  const label2 = await js(`return document.body.innerText.match(/Intento #\\d+ de 2/)?.[0];`);
  check('Segundo intento: id nuevo, versión vigente, 20 preguntas', second.attemptId !== before.attemptId && second.bankVersion === v2.version && second.keys.length === 20 && label2 === 'Intento #2 de 2'
    && (await js(`${helpers} return questionText();`)).startsWith('[v2]'), label2);
  // Natural expiry of a question while the page is open.
  const q1 = await js(`return document.body.innerText.match(/Pregunta (\\d+) de 20/)?.[1];`);
  await waitFor(`document.body.innerText.includes('Pregunta 2 de 20')`, 'expiración de la pregunta 1', 52000);
  check('Expiración: al agotarse el tiempo pasa a la siguiente pregunta', q1 === '1');
  for (let i = 0; i < 25 && !(await js(`${helpers} return !!button('Finalizar') && !button('Siguiente');`)); i++) { await pick('D'); await js(`${helpers} button('Siguiente')?.click();`); await sleep(120); }
  await js(`${helpers} button('Finalizar').click();`);
  await waitFor(`location.pathname.startsWith('/results/')`, 'resultado 2');
  for (let i = 0; i < 50 && (await rowsOf(dni)).length < 2; i++) await sleep(200);
  const both = await rowsOf(dni);
  check('El primer intento no se sobrescribe', both.length === 2 && both[0].id === before.attemptId && both[0].puntaje === finalRows[0].puntaje && JSON.stringify(both[0].respuestas) === JSON.stringify(finalRows[0].respuestas)
    && both[1].id === second.attemptId && both[1].intento_num === 2, JSON.stringify(both.map(r => [r.intento_num, r.puntaje, r.total_preguntas])));
  check('Resultado del 2.º intento: «Sin intentos disponibles»', await js(`return document.body.innerText.includes('Sin intentos disponibles') && !document.body.innerText.includes('Repetir estándar') && !document.body.innerText.includes('Pendiente de aprobación');`));
  // Third attempt: blocked in the interface and by the server for direct calls.
  await go(`/quiz/${code}`);
  await waitFor(`location.pathname === '/standards'`, 'tercer intento redirigido');
  const direct = await js(`
    const post = body => fetch('/api/intentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => [r.status, (await r.json()).code]);
    return [
      await post({ accion: 'iniciar', dni: '${dni}', estandar_codigo: '${code}', total_preguntas: 20 }),
      await post({ id: 'directo-3', dni: '${dni}', nombre: 'x', cargo: 'Ayudante', estandar_codigo: '${code}', estandar_nombre: 'x', fecha: new Date().toISOString(), puntaje: 0, total_preguntas: 10, respuestas: [], tipo: 'USUARIO ANTIGUO', intento_num: 1 }),
    ];`);
  check('Tercer intento bloqueado: interfaz y llamadas directas a la API', JSON.stringify(direct) === JSON.stringify([[409, 'MAX_ATTEMPTS_REACHED'], [409, 'MAX_ATTEMPTS_REACHED']]) && (await rowsOf(dni)).length === 2, JSON.stringify(direct));
  check('Ruta retirada /api/retake-approvals responde 404', await js(`return (await fetch('/api/retake-approvals?dni=${dni}')).status === 404;`));

  // ── 4. Nuevo Ingreso: registro, categorías correctas, recarga, finalización ──
  const niDni = '11223344', niKey = `bisa-ni-quiz-${niDni}`;
  await go('/nuevo-ingreso');
  await waitFor(`document.querySelector('input[placeholder="Buscar o seleccionar cargo..."]')`, 'formulario NI');
  await js(`${helpers}
    setValue(byPlaceholder('Juan Pérez García'), 'Ingreso de prueba');
    const selects = document.querySelectorAll('select');
    setValue(selects[0], selects[0].options[1].value); setValue(selects[1], selects[1].options[1].value);
    setValue(byPlaceholder('jperez@bisa.com.pe'), 'ni@example.com');
    setValue(byPlaceholder('12345678'), '${niDni}');
    const cargo = byPlaceholder('Buscar o seleccionar cargo...'); cargo.focus(); cargo.click(); setValue(cargo, 'Asist. Control');`);
  await waitFor(`[...document.querySelectorAll('div')].some(d => d.textContent.trim() === 'Asist. Control Doc.' && d.onclick !== undefined)`, 'cargo NI');
  await js(`[...document.querySelectorAll('div')].filter(d => d.textContent.trim() === 'Asist. Control Doc.').at(-1).click();`);
  await sleep(200);
  await js(`document.querySelector('form').requestSubmit();`);
  await waitFor(`location.pathname === '/nuevo-ingreso/standards'`, 'estándares NI');
  await waitFor(`document.body.innerText.includes('Intento 1 de 2')`, 'contador NI desde los registros');
  check('Registro de participante (Nuevo Ingreso) por formulario', true);
  await go('/nuevo-ingreso/quiz-global');
  await waitFor(`document.body.innerText.includes('Comenzar Evaluación')`, 'inicio NI');
  await js(`${helpers} button('Comenzar Evaluación').click();`);
  await waitFor(`document.querySelector('.question-card__text')`, 'pregunta NI');
  const niState = await quizState(niKey);
  const bank = await api(`datos?module=preguntas&version=${niState.bankVersion}`);
  const expectedCategory = Object.fromEntries(bank.data.flatMap(est => est.preguntas.map(p => [`${est.estandar_codigo}#${p.id}`, est.estandar_nombre])));
  const expectedText = Object.fromEntries(bank.data.flatMap(est => est.preguntas.map(p => [`${est.estandar_codigo}#${p.id}`, p.pregunta])));
  const sharedNumbers = new Set(niState.keys.map(k => k.split('#')[1])).size < niState.keys.length || bank.data.length > 1;
  let categoriesOk = true;
  const categoryOf = () => js(`return document.querySelector('.question-card__category')?.textContent;`);
  for (let i = 0; i < 2; i++) {
    categoriesOk &&= await categoryOf() === expectedCategory[niState.keys[i]] && await js(`${helpers} return questionText();`) === expectedText[niState.keys[i]];
    await pick(i === 0 ? 'A' : 'B');
    if (i === 0) { await js(`${helpers} button('Siguiente').click();`); await sleep(200); }
  }
  await sleep(3000);
  const niSeconds = await shownSeconds();
  await sleep(3000);
  await reload();
  await waitFor(`document.querySelector('.question-card__text')`, 'NI tras recargar');
  const niAfter = await quizState(niKey);
  check('Nuevo Ingreso: recarga conserva intento, posición, respuestas y tiempo', niAfter.attemptId === niState.attemptId && niAfter.actual === 1 && await selectedLetter() === 'B'
    && JSON.stringify(niAfter.respuestas) === JSON.stringify({ 0: 'A', 1: 'B' }) && (await shownSeconds()) <= niSeconds - 2, `${niSeconds}s, 3 s de espera y recarga, ${await shownSeconds()}s`);
  for (let i = 1; i < 20; i++) {
    const index = await js(`return Number(document.body.innerText.match(/Pregunta (\\d+) de 20/)?.[1]) - 1;`);
    categoriesOk &&= await categoryOf() === expectedCategory[niState.keys[index]] && await js(`${helpers} return questionText();`) === expectedText[niState.keys[index]];
    if (i > 1) await pick('C');
    if (await js(`${helpers} return !!button('Siguiente');`)) { await js(`${helpers} button('Siguiente').click();`); await sleep(120); }
  }
  check('Nuevo Ingreso: cada categoría corresponde a su pregunta (código + id)', categoriesOk, `20 preguntas de ${new Set(niState.keys.map(k => k.split('#')[0])).size} estándares; números repetidos entre estándares: ${sharedNumbers}`);
  await js(`${helpers} const f = button('Finalizar Evaluación'); f.click(); f.click();`);
  await waitFor(`location.pathname === '/nuevo-ingreso/resultado'`, 'resultado NI');
  for (let i = 0; i < 50 && !(await rowsOf(niDni)).length; i++) await sleep(200);
  const niRows = await rowsOf(niDni);
  check('Nuevo Ingreso: un único resultado con el id del intento', niRows.length === 1 && niRows[0].id === niState.attemptId && niRows[0].tipo === 'NUEVO INGRESO' && niRows[0].respuestas.length === 20, `puntaje ${niRows[0]?.puntaje}`);
  check('Visualización del resultado (Nuevo Ingreso)', await js(`return /\\d+\\/20/.test(document.body.innerText);`));
  await shot('2-resultado-nuevo-ingreso.png');

  // ── 5. Administración ──
  await go('/admin');
  await waitFor(`document.querySelector('input[type=password]')`, 'login');
  await js(`const input = document.querySelector('input[type=password]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(process.env.ADMIN_PASSWORD)});
    input.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('form').requestSubmit();`);
  await waitFor(`document.body.innerText.includes('Panel de Administración')`, 'panel');
  await waitFor(`document.querySelector('.admin-stat__value')?.textContent === '3'`, 'KPI de evaluaciones');
  check('Acceso administrativo y monitoreo (3 evaluaciones)', true);
  await js(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Gestión de Datos')).click();`);
  await waitFor(`document.body.innerText.split('Versión vigente').length >= 5`, 'cuatro módulos cargados');
  const labels = await js(`${helpers} return ${JSON.stringify(TITLES)}.map(t => buttons(card(t)).map(b => b.textContent.trim()));`);
  check('Resultados: solo Descargar', JSON.stringify(labels[0]) === JSON.stringify(['⬇ Descargar (Excel)']), labels[0].join(' | '));
  for (let i = 1; i < 5; i++) check(`${TITLES[i]}: Descargar y Subir`, labels[i].includes('⬇ Descargar (Excel)') && labels[i].includes('⬆ Subir (Excel)'), labels[i].join(' | '));
  const statusLines = await js(`${helpers} return ${JSON.stringify(TITLES.slice(1))}.map(t => card(t).innerText.split('\\n').find(l => l.includes('Versión vigente')));`);
  check('Datos del panel (banco publicado en la prueba, links 31, matrices 185/670)', /32 estándares — 1280 preguntas/.test(statusLines[0]) && /^31 estándares/.test(statusLines[1]) && /31 cargos · 185/.test(statusLines[2]) && /31 cargos · 670/.test(statusLines[3]), statusLines.join(' / '));
  await shot('3-gestion-de-datos.png');

  for (const title of TITLES) { await clickIn(title, 'Descargar (Excel)'); await sleep(1500); }
  let files = [];
  for (let i = 0; i < 60; i++) { files = (await readdir(join(OUT, 'downloads'))).filter(f => f.endsWith('.xlsx')); if (files.length >= 5) break; await sleep(500); }
  check('Cinco descargas generadas', files.length === 5, files.join(', '));
  for (const file of files) {
    const zip = await JSZip.loadAsync(await readFile(join(OUT, 'downloads', file)));
    const table = Object.keys(zip.files).find(n => /^xl\/tables\/table\d+\.xml$/.test(n));
    const xml = table ? await zip.file(table).async('string') : '';
    const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
    check(`Tabla nativa en ${file}`, /<autoFilter/.test(xml) && /showRowStripes="1"/.test(xml) && /state="frozen"/.test(sheet), `${xml.match(/displayName="([^"]+)"/)?.[1]} ${xml.match(/ref="([^"]+)"/)?.[1]}`);
    if (file.startsWith('bisa-evaluaciones')) check('Exportación de resultados con las 3 evaluaciones', xml.match(/ref="([^"]+)"/)?.[1] === 'A1:N4');
  }

  const links = toRows('links', (await current('links')).data);
  const linksBefore = (await current('links')).version;
  await setFile('Links de Estándares', await xlsx('links', [{ ...links[0], video: 'https://cobraperusa.sharepoint.com/:v:/s/prueba/video-ui' }], 'links-mod.xlsx'));
  await waitFor(`document.body.innerText.includes('1 modificados')`, 'vista previa links');
  check('Vista previa antes de publicar (links)', (await current('links')).version === linksBefore, (await cardText('Links de Estándares')).split('\n').find(l => l.includes('registros leídos')));
  await clickIn('Links de Estándares', 'Confirmar publicación');
  await waitFor(`document.body.innerText.includes('Publicado para todos los usuarios')`, 'publicación links');
  check('Publicación confirmada (links)', (await current('links')).data[links[0].codigo].video.endsWith('video-ui'));

  const bankRows = toRows('preguntas', (await current('preguntas')).data);
  await setFile('Banco de Preguntas', await xlsx('preguntas', [{ ...bankRows[0], respuesta: 'F' }], 'preguntas-invalidas.xlsx'));
  await waitFor(`document.body.innerText.includes('errores bloqueantes')`, 'errores');
  check('Archivo inválido: errores visibles y publicación deshabilitada', await disabled('Banco de Preguntas', 'Confirmar publicación'));
  await clickIn('Banco de Preguntas', 'Cancelar');

  const intake = toRows('nuevo-ingreso', (await current('nuevo-ingreso')).data);
  await setFile('Matriz de Nuevo Ingreso', await xlsx('nuevo-ingreso', intake.slice(0, -1), 'matriz-sin-una.xlsx'));
  await waitFor(`document.body.innerText.includes('no hay nada que publicar')`, 'vista previa parcial');
  await js(`${helpers} [...card('Matriz de Nuevo Ingreso').querySelectorAll('label')].find(l => l.textContent.includes('Sincronización completa')).querySelector('input').click();`);
  await waitFor(`document.body.innerText.includes('1 eliminados')`, 'vista previa completa');
  const lockedBefore = await disabled('Matriz de Nuevo Ingreso', 'Confirmar publicación');
  await js(`${helpers} [...card('Matriz de Nuevo Ingreso').querySelectorAll('label')].find(l => l.textContent.includes('Confirmo que se eliminarán 1')).querySelector('input').click();`);
  await sleep(200);
  check('Sincronización completa exige confirmar eliminaciones', lockedBefore && !(await disabled('Matriz de Nuevo Ingreso', 'Confirmar publicación')));
  await clickIn('Matriz de Nuevo Ingreso', 'Confirmar publicación');
  await waitFor(`document.body.innerText.includes('1 eliminados.')`, 'publicación matriz');
  check('Eliminación publicada (184 asignaciones)', (await current('nuevo-ingreso')).count === 184);
  await clickIn('Matriz de Nuevo Ingreso', 'Versiones anteriores');
  await waitFor(`(() => { ${helpers} return byLabel(card('Matriz de Nuevo Ingreso'), 'Restaurar'); })()`, 'lista de versiones');
  await clickIn('Matriz de Nuevo Ingreso', 'Restaurar', true);
  await waitFor(`document.body.innerText.includes('Versión restaurada')`, 'restauración');
  const restored = await current('nuevo-ingreso');
  check('Restauración de la versión original (185)', restored.count === 185 && JSON.stringify(toRows('nuevo-ingreso', restored.data)) === JSON.stringify(intake));
  await shot('4-restauracion.png');

  check('Sin excepciones de JavaScript en el navegador', exceptions.length === 0, exceptions.slice(0, 3).join(' | '));
} catch (error) {
  check('Ejecución', false, error.message);
  await shot('error.png').catch(() => {});
} finally {
  ws.close(); browser.kill();
  await vite.close();
  await new Promise(done => apiServer.close(done));
  await db.close();
  await sleep(1000);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
  await rm(dataDir, { recursive: true, force: true }).catch(() => {});
  const intact = (await Promise.all(originals.map(sha))).every((hash, i) => hash === originalHashes[i]);
  check('Matrices originales de .local-matrices intactas', intact);
  await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
}
const failed = report.filter(r => !r.ok).length;
console.log(`\n${report.length - failed}/${report.length} comprobaciones aprobadas · evidencias en ${OUT}`);
process.exit(failed ? 1 : 0);
