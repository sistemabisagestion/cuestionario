import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import matricesEndpoint from '../api/matrices.js';
import { createDevelopmentServer } from '../scripts/dev-api.mjs';
import { frontendModules } from './helpers/frontend-modules.mjs';

const nativeFetch = globalThis.fetch;
let server, base, api;
before(async () => {
  ({ api } = await frontendModules());
  process.env.MATRICES_STORAGE = 'disabled';
  server = createServer((req, res) => {
    if (req.url.startsWith('/api/matrices')) return matricesEndpoint(req, res);
    const name = req.url.split('/').at(-1);
    const responses = {
      ok: [200, 'application/json', '{"ok":true}'],
      empty: [200, 'application/json', ''], missing: [404, null, ''], whitespace: [200, 'application/json', '  '],
      html: [200, 'text/html', '<html>Unexpected index</html>'], htmlError: [502, 'text/html', '<html>Proxy error</html>'],
      invalid: [200, 'application/json', '{broken'], null: [200, 'application/json', 'null'],
      unauthorized: [401, 'application/json', '{"error":"Sesión de administrador requerida"}'],
      denied: [403, 'application/json', '{}'], backend: [503, 'application/json', '{"error":"Almacén no disponible: error real del servidor"}'],
    };
    if (name === 'gone') { res.statusCode = 404; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.setHeader('X-Vercel-Error', 'DEPLOYMENT_NOT_FOUND'); return res.end('The deployment could not be found on Vercel.'); }
    const [status, type, body] = responses[name] ?? [404, 'application/json', '{"error":"Ruta desconocida"}'];
    res.statusCode = status; if (type) res.setHeader('Content-Type', type); res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  globalThis.fetch = (url, options) => nativeFetch(new URL(url, base), options);
});
after(async () => { globalThis.fetch = nativeFetch; await new Promise(resolve => server.close(resolve)); });

test('API client accepts actual successful JSON responses', async () => {
  assert.deepEqual(await api.apiRequest('ok'), { ok: true });
});
test('empty, missing and whitespace JSON responses show Spanish error with HTTP status and route', async () => {
  for (const [route, status] of [['empty', 200], ['missing', 404], ['whitespace', 200]]) {
    await assert.rejects(api.apiRequest(route), error => error.status === status && /respuesta vacía/.test(error.message) && error.message.includes(`/api/${route}`) && !/Unexpected end/.test(error.message));
  }
});
test('HTML, malformed JSON and null responses fail clearly without leaking response markup', async () => {
  for (const [route, pattern] of [['html', /HTML/], ['htmlError', /HTML/], ['invalid', /JSON inválido/], ['null', /JSON vacío/]]) {
    await assert.rejects(api.apiRequest(route), error => pattern.test(error.message) && !error.message.includes('<html>'));
  }
});
test('authorization errors and real backend messages are preserved', async () => {
  await assert.rejects(api.apiRequest('unauthorized'), { status: 401, message: 'Sesión de administrador requerida' });
  await assert.rejects(api.apiRequest('denied'), error => error.status === 403 && /autorización/.test(error.message));
  await assert.rejects(api.apiRequest('backend'), { status: 503, message: 'Almacén no disponible: error real del servidor' });
});
test('a removed Vercel deployment URL gets an explicit message pointing to the official domain', async () => {
  await assert.rejects(api.apiRequest('gone'), error => error.status === 404 && error.code === 'DEPLOYMENT_NOT_FOUND' && error.message.includes('https://cuestionario-bisa1.vercel.app/'));
  // The administrator modal on an old tab of a removed deployment.
  globalThis.fetch = (url, options) => nativeFetch(new URL('/api/gone', base), options);
  try { await assert.rejects(api.loginAdmin('x'), error => /ya no existe/.test(error.message) && !/proxy de desarrollo|npm run dev/.test(error.message)); }
  finally { globalThis.fetch = (url, options) => nativeFetch(new URL(url, base), options); }
});
test('disabled storage returns actual valid JSON 503, not a fake empty matrix', async () => {
  await assert.rejects(api.apiRequest('matrices?type=nuevo-ingreso'), error => error.status === 503 && /sin habilitar/.test(error.message));
});
test('unavailable API is handled without an unhandled native fetch exception', async () => {
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  try { await assert.rejects(api.apiRequest('matrices?type=nuevo-ingreso'), error => error.status === null && /no se pudo conectar/.test(error.message)); }
  finally { globalThis.fetch = (url, options) => nativeFetch(new URL(url, base), options); }
});
test('complete development router registers matrices and returns JSON for unknown routes', async () => {
  const dev = createDevelopmentServer();
  await new Promise(resolve => dev.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${dev.address().port}`;
  try {
    const health = await nativeFetch(`${address}/api/health`);
    assert.equal((await health.json()).matrices, true);
    const unavailable = await nativeFetch(`${address}/api/matrices?type=nuevo-ingreso`);
    assert.equal(unavailable.status, 503); assert.match(unavailable.headers.get('content-type'), /json/); assert.match((await unavailable.json()).error, /sin habilitar/);
    const missing = await nativeFetch(`${address}/api/missing`);
    assert.equal(missing.status, 404); assert.match((await missing.json()).error, /Ruta API/);
  } finally { await new Promise(resolve => dev.close(resolve)); }
});
