import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from './http.js';

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must have at least 32 characters');
  return value;
}
export function adminAuthConfigured() {
  return typeof process.env.ADMIN_PASSWORD === 'string' && process.env.ADMIN_PASSWORD.length > 0
    && typeof process.env.SESSION_SECRET === 'string' && process.env.SESSION_SECRET.length >= 32;
}
export function signature(value) { return createHmac('sha256', secret()).update(value).digest('base64url'); }
export function equal(a, b) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function setSession(res, role, dni) {
  const value = Buffer.from(JSON.stringify({ role, dni, exp: Date.now() + 8 * 3600000 })).toString('base64url');
  const name = role === 'admin' ? 'bisa_admin' : 'bisa_participant';
  res.setHeader('Set-Cookie', `${name}=${value}.${signature(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}
export function session(req, role) {
  const name = role === 'admin' ? 'bisa_admin' : 'bisa_participant';
  const token = (req.headers.cookie ?? '').split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!token) return null;
  try {
    const [value, mac] = token.split('.');
    if (!mac || !equal(mac, signature(value))) return null;
    const data = JSON.parse(Buffer.from(value, 'base64url').toString());
    return data.role === role && data.exp > Date.now() ? data : null;
  } catch { return null; }
}
export function authorize(req, dni) {
  if (session(req, 'admin')) return;
  if (!dni || session(req, 'participant')?.dni !== dni) throw new HttpError(401, 'Sesión requerida');
}
export function requireAdmin(req) {
  if (!session(req, 'admin')) throw new HttpError(401, 'Sesión de administrador requerida');
}
export function validateDni(dni) {
  if (typeof dni !== 'string' || !/^\d{8}$/.test(dni)) throw new HttpError(400, 'DNI inválido');
}
