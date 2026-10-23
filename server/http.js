export class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

const NETWORK_ERRORS = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'EHOSTUNREACH']);

// Reads are idempotent, so a transient storage failure is retried before the request fails.
// `isFinal` errors (e.g. "not found") are returned to the caller immediately.
export async function retryRead(read, { attempts = 3, delays = [150, 400], isFinal = () => false } = {}) {
  for (let attempt = 1; ; attempt++) {
    try { return await read(); }
    catch (error) {
      if (attempt >= attempts || isFinal(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, delays[attempt - 1] ?? delays.at(-1)));
    }
  }
}

// Error text for logs: no URLs, connection strings or long payloads.
export function logSafeMessage(error) {
  return String(error?.message ?? '').replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>').replace(/\s+/g, ' ').slice(0, 160);
}

export function endpoint(action, { maxBodyBytes = 262144 } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (!['GET', 'HEAD'].includes(req.method)) {
        const origin = req.headers.origin;
        const host = req.headers.host;
        if (req.headers['sec-fetch-site'] === 'cross-site' || (origin && new URL(origin).host !== host)) {
          throw new HttpError(403, 'Origen no permitido');
        }
        if (req.method !== 'DELETE') {
          if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Se requiere JSON');
          if (!req.body) {
            let raw = '';
            for await (const chunk of req) {
              raw += chunk;
              if (Buffer.byteLength(raw) > maxBodyBytes) throw new HttpError(413, 'Solicitud demasiado grande');
            }
            try { req.body = JSON.parse(raw); } catch { throw new HttpError(400, 'JSON inválido'); }
          }
          if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new HttpError(400, 'Se requiere un objeto JSON');
          if (Buffer.byteLength(JSON.stringify(req.body)) > maxBodyBytes) throw new HttpError(413, 'Solicitud demasiado grande');
        }
      }
      const result = await action(req, res);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(result ?? {}));
    } catch (error) {
      // Unexpected failures keep HTTP 503 (clients may retry); the code tells unreachable storage from internal errors.
      const failure = error instanceof HttpError ? error
        : NETWORK_ERRORS.has(error?.code) ? new HttpError(503, 'Servicio temporalmente no disponible: el servidor no pudo conectar con su almacenamiento.', 'SERVICE_UNAVAILABLE')
          : new HttpError(503, 'Error interno del servidor. Intenta nuevamente; si persiste, revisa la terminal donde se ejecuta npm run dev.', 'INTERNAL_ERROR');
      res.statusCode = failure.status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      // Never log connection strings, query parameters, passwords, or personal data.
      if (!(error instanceof HttpError)) console.error('Database/API operation failed', error?.name, error?.code ?? '', logSafeMessage(error));
      res.end(JSON.stringify({ error: failure.message, ...(failure.code ? { code: failure.code } : {}) }));
    }
  };
}

export function allow(req, res, methods) {
  if (!methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '));
    throw new HttpError(405, 'Método no permitido');
  }
}
