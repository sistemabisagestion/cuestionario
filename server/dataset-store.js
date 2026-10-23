import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, open, rename, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { HttpError, retryRead } from './http.js';
import { DATASET_MODULES } from '../shared/datasets.mjs';

// Layout (same in both adapters):
//   <module>/versions/<versionId>.json  immutable, written once with a unique name
//   <module>/manifest.json              active version + history, replaced only by compare-and-swap
// A publication writes the new version first and then swaps the manifest; readers only
// follow the manifest, so a failed or partial publication is never visible.
export const datasetConflict = () => new HttpError(409, 'Otro administrador publicó una versión mientras revisabas los cambios. Vuelve a subir el archivo para compararlo con la versión vigente.', 'VERSION_CONFLICT');
const VERSION_ID = /^[0-9A-Za-z-]{8,80}$/;
const hash = text => createHash('sha256').update(text).digest('hex');
const MAX_DOCUMENT_BYTES = 16 * 1048576;
function checkPath(module, versionId) {
  if (!DATASET_MODULES.includes(module)) throw new HttpError(400, 'Módulo inválido.');
  if (versionId !== undefined && !VERSION_ID.test(versionId)) throw new HttpError(400, 'Versión inválida.');
}
export function newVersionId(now = new Date()) {
  return `${now.toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
}

// Development and tests. Never used on Vercel or with NODE_ENV=production.
export function localDatasetStore(directory) {
  const root = resolve(directory);
  const manifestPath = module => join(root, module, 'manifest.json');
  async function readJson(path) {
    try {
      const text = await readFile(path, 'utf8');
      return { document: JSON.parse(text), etag: hash(text) };
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  return {
    kind: 'local',
    async readManifest(module) { checkPath(module); return readJson(manifestPath(module)); },
    async readManifestForUpdate(module) { checkPath(module); return readJson(manifestPath(module)); },
    async readVersion(module, versionId) { checkPath(module, versionId); return (await readJson(join(root, module, 'versions', `${versionId}.json`)))?.document ?? null; },
    async writeVersion(module, versionId, document) {
      checkPath(module, versionId);
      await mkdir(join(root, module, 'versions'), { recursive: true });
      let file;
      try { file = await open(join(root, module, 'versions', `${versionId}.json`), 'wx'); }
      catch (error) { if (error.code === 'EEXIST') throw datasetConflict(); throw error; }
      try { await file.writeFile(JSON.stringify(document)); await file.sync(); } finally { await file.close(); }
    },
    async writeManifest(module, document, expectedEtag) {
      checkPath(module);
      await mkdir(join(root, module), { recursive: true });
      const lockPath = join(root, module, 'manifest.lock');
      let lock;
      try { lock = await open(lockPath, 'wx'); }
      catch (error) { if (error.code === 'EEXIST') throw datasetConflict(); throw error; }
      const temp = join(root, module, `manifest.${randomUUID()}.tmp`);
      try {
        const latest = await readJson(manifestPath(module));
        if ((latest?.etag ?? null) !== expectedEtag) throw datasetConflict();
        const text = JSON.stringify(document);
        const file = await open(temp, 'wx');
        try { await file.writeFile(text); await file.sync(); } finally { await file.close(); }
        await rename(temp, manifestPath(module));
        return { document, etag: hash(text) };
      } finally {
        await unlink(temp).catch(() => {});
        await lock.close();
        await unlink(lockPath);
      }
    },
  };
}

// Private Vercel Blob store, accessed only from the backend.
// SDK facts this relies on (@vercel/blob 2.8): get() returns null on 404 and useCache:false
// reads origin storage; only put/head/list ETags are documented for ifMatch; the SDK retries
// requests, so a write can succeed even when its response reports an error.
export function blobDatasetStore(sdk, prefix = 'bisaquiz/datos') {
  const manifestPath = module => `${prefix}/${module}/manifest.json`;
  const versionPath = (module, versionId) => `${prefix}/${module}/versions/${versionId}.json`;
  const isPrecondition = error => !!sdk.BlobPreconditionFailedError && error instanceof sdk.BlobPreconditionFailedError;
  const isNotFound = error => !!sdk.BlobNotFoundError && error instanceof sdk.BlobNotFoundError;
  async function readJson(path) {
    // useCache:false reads origin storage, so every user sees the same active manifest.
    const result = await retryRead(() => sdk.get(path, { access: 'private', useCache: false }), { isFinal: isNotFound });
    if (!result) return null;
    if (result.statusCode !== 200 || !result.stream || result.blob.size > MAX_DOCUMENT_BYTES) throw new Error('Invalid blob response');
    return JSON.parse(await new Response(result.stream).text());
  }
  const orNull = promise => promise.catch(error => { if (isNotFound(error)) return null; throw error; });
  return {
    kind: 'blob',
    // Public reads: content only (one read per request).
    async readManifest(module) {
      checkPath(module);
      const document = await orNull(readJson(manifestPath(module)));
      return document ? { document, etag: null } : null;
    },
    // Before a write: ETag from head() first, then content. If the manifest changes in
    // between, the later ifMatch fails (409); it can never overwrite a newer manifest.
    async readManifestForUpdate(module) {
      checkPath(module);
      const meta = await orNull(sdk.head(manifestPath(module)));
      if (!meta) return null;
      const document = await orNull(readJson(manifestPath(module)));
      if (!document) throw datasetConflict();
      return { document, etag: meta.etag };
    },
    async readVersion(module, versionId) {
      checkPath(module, versionId);
      return orNull(readJson(versionPath(module, versionId)));
    },
    async writeVersion(module, versionId, document) {
      checkPath(module, versionId);
      const text = JSON.stringify(document);
      try {
        await sdk.put(versionPath(module, versionId), text, {
          access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json', cacheControlMaxAge: 31536000,
        });
      } catch (error) {
        // "Already exists" is not a precondition error in the SDK. Identical content means
        // this same write already succeeded (retried request); anything else is a conflict.
        const existing = await orNull(readJson(versionPath(module, versionId))).catch(() => null);
        if (existing && JSON.stringify(existing) === text) return;
        if (existing || isPrecondition(error)) throw datasetConflict();
        throw error;
      }
    },
    async writeManifest(module, document, expectedEtag) {
      checkPath(module);
      try {
        const result = await sdk.put(manifestPath(module), JSON.stringify(document), {
          access: 'private', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 60,
          // First publication creates only; later ones must match the ETag read with head().
          allowOverwrite: expectedEtag !== null, ...(expectedEtag !== null ? { ifMatch: expectedEtag } : {}),
        });
        return { document, etag: result.etag };
      } catch (error) {
        if (isPrecondition(error)) throw datasetConflict();
        // A lost creation race surfaces as a generic error: re-read once, never overwrite.
        if (expectedEtag === null && await orNull(readJson(manifestPath(module))).catch(() => null)) throw datasetConflict();
        throw error;
      }
    },
  };
}

// Same switch as the matrices: disabled unless explicitly configured.
// Returns null when disabled, so read-only built-in data can still be served.
let configured;
export async function configuredDatasetStore() {
  if (configured) return configured;
  const mode = process.env.MATRICES_STORAGE ?? 'disabled';
  if (mode === 'local' && !process.env.VERCEL && process.env.NODE_ENV !== 'production') {
    configured = localDatasetStore(join(process.env.MATRICES_LOCAL_DIR || '.local-matrices', 'datos'));
  } else if (mode === 'blob' && process.env.MATRICES_BLOB_APPROVED === 'true') {
    if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)) throw new HttpError(503, 'Faltan credenciales del almacén de datos.');
    configured = blobDatasetStore(await import('@vercel/blob'));
  } else return null;
  return configured;
}
export function resetConfiguredDatasetStore() { configured = undefined; }
