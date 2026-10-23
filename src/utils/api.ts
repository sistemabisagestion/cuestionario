export class ApiError extends Error {
  status: number | null;
  code: string | null;
  constructor(message: string, status: number | null = null, code: string | null = null) { super(message); this.name = 'ApiError'; this.status = status; this.code = code; }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `/api/${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...options, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new ApiError('Servidor desconectado: no se pudo conectar con la API. Comprueba que npm run dev siga en ejecución e intenta nuevamente.', null, 'API_UNREACHABLE');
  }
  const context = `${url} (HTTP ${response.status})`;
  let text: string;
  try { text = await response.text(); }
  catch { throw new ApiError(`Se interrumpió la respuesta de ${context}. Intenta nuevamente.`, response.status); }
  if (!text.trim()) {
    throw new ApiError(`La API devolvió una respuesta vacía en ${context}. Comprueba la ruta y reinicia el servidor API si ejecuta una versión anterior.`, response.status);
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!/^application\/(?:[\w.-]+\+)?json(?:\s*;|$)/i.test(contentType)) {
    throw new ApiError(`La API devolvió ${/html|^\s*</i.test(contentType + text) ? 'HTML' : 'un contenido que no es JSON'} en ${context}. Revisa la ruta /api y el proxy de desarrollo.`, response.status);
  }
  let body: unknown;
  try { body = JSON.parse(text); }
  catch { throw new ApiError(`La API devolvió JSON inválido en ${context}. Revisa el servidor API.`, response.status); }
  const error = body && typeof body === 'object' && 'error' in body ? (body as { error: unknown }).error : null;
  if (!response.ok) {
    const message = typeof error === 'string' && error.trim() ? error : response.status === 401 || response.status === 403
      ? 'No tienes autorización o tu sesión expiró. Inicia sesión como administrador.'
      : `La API no pudo completar la solicitud: ${context}.`;
    const code = body && typeof body === 'object' && 'code' in body && typeof body.code === 'string' ? body.code : null;
    throw new ApiError(message, response.status, code);
  }
  if (body === null) throw new ApiError(`La API devolvió un contenido JSON vacío en ${context}.`, response.status);
  return body as T;
}

let sessionQueue: Promise<unknown> = Promise.resolve();
export function withParticipant<T>(dni: string, action: () => Promise<T>): Promise<T> {
  // Serialize session selection and request, including multiple pending users.
  const result = sessionQueue.catch(() => {}).then(async () => {
    await apiRequest('session', { method: 'POST', body: JSON.stringify({ dni }) });
    return action();
  });
  sessionQueue = result;
  return result;
}
export async function loginAdmin(password: string): Promise<void> {
  try {
    const result = await apiRequest<{ ok?: boolean }>('session', { method: 'POST', body: JSON.stringify({ password }) });
    if (result.ok !== true) throw new ApiError('La API no confirmó el inicio de sesión.');
    // A successful POST alone does not prove the browser accepted the cookie.
    const current = await apiRequest<{ admin?: boolean }>('session');
    if (current.admin !== true) throw new ApiError('No se pudo conservar la sesión administrativa. Revisa las cookies y usa el mismo host para ingresar.');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && (error.code === 'INVALID_ADMIN_CREDENTIALS' || error.message === 'Contraseña incorrecta')) {
      throw new ApiError('Contraseña incorrecta', 401, 'INVALID_ADMIN_CREDENTIALS');
    }
    // Three distinct outcomes for the user: wrong password, server disconnected, internal error.
    const status = error instanceof ApiError ? error.status : null;
    const detail = error instanceof Error ? error.message : 'No se pudo completar el inicio de sesión.';
    if (error instanceof ApiError && error.code === 'API_UNREACHABLE') {
      throw new ApiError(detail.startsWith('Servidor desconectado') ? detail : `Servidor desconectado. ${detail}`, status, 'API_UNREACHABLE');
    }
    throw new ApiError(detail.startsWith('Error interno del servidor') ? detail : `Error interno del servidor de autenticación. ${detail}`, status, 'ADMIN_AUTH_ERROR');
  }
}
export async function logoutSession(): Promise<void> {
  await apiRequest('session', { method: 'DELETE' });
}
