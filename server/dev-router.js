import { createServer } from 'node:http';
import { endpoint, HttpError } from './http.js';
import { adminAuthConfigured } from './auth.js';

export const DEFAULT_API_PORT = 3002;

export function developmentServer(routes, service, details = {}) {
  const missing = endpoint(() => { throw new HttpError(404, 'Ruta API no encontrada. Comprueba la URL y reinicia la API si ejecuta una versión anterior.'); });
  const health = endpoint(() => ({ service, version: 'matrices-v1', matrices: true, storage: process.env.MATRICES_STORAGE ?? 'disabled', adminAuthConfigured: adminAuthConfigured(), ...details }));
  return createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const handler = path === '/api/health' ? health : routes[path] ?? missing;
    void handler(req, res);
  });
}

export function listenDevelopment(server, label) {
  const port = Number(process.env.BISA_API_PORT || DEFAULT_API_PORT);
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `El puerto ${port} está ocupado. Detén la API anterior antes de iniciar ${label}.` : 'No se pudo iniciar el servidor API local.');
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => console.log(`${label}: http://127.0.0.1:${server.address().port} (matrices-v1)`));
}
