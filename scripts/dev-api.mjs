import { pathToFileURL } from 'node:url';
import { developmentServer, listenDevelopment } from '../server/dev-router.js';
import intentos from '../api/intentos.js';
import session from '../api/session.js';
import matrices from '../api/matrices.js';
import datos from '../api/datos.js';
import { isTestDatabase } from './dev.mjs';

const routes = { '/api/intentos': intentos, '/api/session': session, '/api/matrices': matrices, '/api/datos': datos };
export function createDevelopmentServer() { return developmentServer(routes, 'bisaquiz-api'); }
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  // A local run must never write results to production: only the verified Neon test branch is accepted.
  if (process.env.DATABASE_URL && !isTestDatabase(process.env.DATABASE_URL)) {
    console.error('La API local se negó a iniciar: DATABASE_URL no es la rama de pruebas verificada de Neon. Nunca uses la base de producción en desarrollo.');
    process.exit(1);
  }
  listenDevelopment(createDevelopmentServer(), 'API local');
}
