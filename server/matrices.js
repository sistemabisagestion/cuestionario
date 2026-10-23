import { MATRIX_TYPES } from '../shared/matrices.mjs';
import { HttpError } from './http.js';
import { activeDataset } from './datasets.js';

// Same response shape as before; `revision` is the active published version.
export async function handleMatrices(req, store) {
  const type = new URL(req.url, 'http://localhost').searchParams.get('type');
  if (!MATRIX_TYPES.includes(type)) throw new HttpError(400, 'Tipo de matriz inválido.');
  const active = await activeDataset(type, store);
  return { type, revision: active.versionId, mapping: active.data, updatedAt: active.updatedAt };
}
