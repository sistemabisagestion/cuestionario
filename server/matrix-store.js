import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, open, rename, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { HttpError, retryRead } from './http.js';

export const conflict = () => new HttpError(409, 'La matriz cambió. Vuelve a descargarla y revisa los cambios antes de confirmar.');
const hash = text => createHash('sha256').update(text).digest('hex');

// Development only. An exclusive file lock protects CAS across local processes;
// a same-directory rename commits current+previous together. Never used on Vercel.
export function localMatrixStore(directory) {
  const root = resolve(directory);
  async function read(type) {
    try {
      const text = await readFile(join(root, `${type}.json`), 'utf8');
      return { document: JSON.parse(text), etag: hash(text) };
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  return {
    read,
    async write(type, document, expected) {
      await mkdir(root, { recursive: true });
      const lockPath = join(root, `${type}.lock`);
      let lock;
      try { lock = await open(lockPath, 'wx'); }
      catch (error) { if (error.code === 'EEXIST') throw conflict(); throw error; }
      const temp = join(root, `${type}.${randomUUID()}.tmp`);
      try {
        const latest = await read(type);
        if ((latest?.etag ?? null) !== expected) throw conflict();
        const text = JSON.stringify(document);
        const file = await open(temp, 'wx');
        try { await file.writeFile(text); await file.sync(); } finally { await file.close(); }
        await rename(temp, join(root, `${type}.json`));
        return { document, etag: hash(text) };
      } finally {
        await unlink(temp).catch(() => {});
        await lock.close();
        await unlink(lockPath);
      }
    },
  };
}

export function blobMatrixStore(sdk) {
  const path = type => `bisaquiz/matriz-${type}.json`;
  return {
    async read(type) {
      // Bypass CDN cache: stale reads are unacceptable for assignment selection.
      const result = await retryRead(() => sdk.get(path(type), { access: 'private', useCache: false }),
        { isFinal: error => !!sdk.BlobNotFoundError && error instanceof sdk.BlobNotFoundError });
      if (!result) return null;
      if (result.statusCode !== 200 || !result.stream || result.blob.size > 1048576) throw new Error('Invalid blob response');
      const text = await new Response(result.stream).text();
      if (Buffer.byteLength(text) > 1048576) throw new Error('Matrix too large');
      return { document: JSON.parse(text), etag: result.blob.etag };
    },
    async write(type, document, expected) {
      try {
        const result = await sdk.put(path(type), JSON.stringify(document), {
          access: 'private', addRandomSuffix: false, contentType: 'application/json',
          cacheControlMaxAge: 60,
          // First writer creates only; subsequent writers must match storage ETag.
          allowOverwrite: expected !== null, ...(expected !== null ? { ifMatch: expected } : {}),
        });
        return { document, etag: result.etag };
      } catch (error) {
        if (sdk.BlobPreconditionFailedError && error instanceof sdk.BlobPreconditionFailedError) throw conflict();
        // Creation collisions are reported as a general BlobError by the SDK.
        // Re-read only on failed create; never retry the write unconditionally.
        if (expected === null && await this.read(type)) throw conflict();
        throw error;
      }
    },
  };
}

let configured;
export async function configuredMatrixStore() {
  if (configured) return configured;
  const mode = process.env.MATRICES_STORAGE ?? 'disabled';
  if (mode === 'local' && !process.env.VERCEL && process.env.NODE_ENV !== 'production') {
    configured = localMatrixStore(process.env.MATRICES_LOCAL_DIR || '.local-matrices');
  } else if (mode === 'blob' && process.env.MATRICES_BLOB_APPROVED === 'true') {
    // Explicit opt-in prevents accidental usage of a production store or budget.
    if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)) throw new HttpError(503, 'Faltan credenciales del almacén de matrices.');
    let sdk;
    try { sdk = await import('@vercel/blob'); }
    catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND') throw new HttpError(503, 'Falta instalar @vercel/blob. Consulta README.md.');
      throw error;
    }
    configured = blobMatrixStore(sdk);
  } else throw new HttpError(503, 'Almacenamiento de matrices sin habilitar. Contacta al administrador.');
  return configured;
}
