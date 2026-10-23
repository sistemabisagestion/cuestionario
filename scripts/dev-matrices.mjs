// Isolated development API: deliberately does not import database/attempt routes.
import { pathToFileURL } from 'node:url';
import { developmentServer, listenDevelopment } from '../server/dev-router.js';
import matrices from '../api/matrices.js';
import session from '../api/session.js';
import datos from '../api/datos.js';
import { adminAuthConfigured } from '../server/auth.js';

const routes = { '/api/matrices': matrices, '/api/datos': datos, '/api/session': session };
export function createMatrixDevelopmentServer() { return developmentServer(routes, 'bisaquiz-matrices-local'); }
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production' || process.env.MATRICES_STORAGE !== 'local') {
    throw new Error('La API aislada requiere MATRICES_STORAGE=local fuera de producción.');
  }
  if (!adminAuthConfigured()) console.error('Autenticación administrativa no disponible: revisa ADMIN_PASSWORD y SESSION_SECRET en la configuración de desarrollo. No se cambiaron credenciales.');
  else console.log('Autenticación administrativa configurada. dev:matrices carga .env.neon-test.local y después .env.matrices.local; las variables heredadas del proceso tienen prioridad.');
  listenDevelopment(createMatrixDevelopmentServer(), 'Matrices locales sin rutas de base de datos');
}
