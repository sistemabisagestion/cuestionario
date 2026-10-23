import { endpoint, allow, HttpError } from '../server/http.js';
import { adminAuthConfigured, equal, session, setSession, validateDni } from '../server/auth.js';

export default endpoint(async (req, res) => {
  allow(req, res, ['GET', 'POST', 'DELETE']);
  if (req.method === 'GET') return { admin: !!session(req, 'admin') };
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', ['bisa_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0', 'bisa_participant=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0']);
    return { ok: true };
  }
  if (Object.hasOwn(req.body, 'password')) {
    if (!adminAuthConfigured()) throw new HttpError(503, 'Servicio de autenticación no disponible: falta una configuración administrativa válida en el servidor.', 'ADMIN_AUTH_UNAVAILABLE');
    if (typeof req.body.password !== 'string' || !equal(req.body.password, process.env.ADMIN_PASSWORD)) throw new HttpError(401, 'Contraseña incorrecta', 'INVALID_ADMIN_CREDENTIALS');
    setSession(res, 'admin');
  } else {
    // Preserve the existing self-registration flow. DNI is not verified identity.
    validateDni(req.body.dni);
    setSession(res, 'participant', req.body.dni);
  }
  return { ok: true };
});
