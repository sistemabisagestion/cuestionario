import { apiRequest } from './api';
import { codesForCargo } from '../../shared/matrices.mjs';
import type { MatrixLink } from '../../shared/matrices.mjs';
export type { MatrixLink };
export type MatrixType = 'nuevo-ingreso' | 'personal-antiguo';
export interface MatrixSnapshot { type: MatrixType; revision: string; mapping: MatrixLink[]; updatedAt: string | null }

// Only in-flight requests are shared. Each page entry/quiz start reads the current
// version, without polling or fetching on every render. No localStorage fallback.
const pending = new Map<MatrixType, Promise<MatrixSnapshot>>();
function checkSnapshot(value: MatrixSnapshot, type: MatrixType): MatrixSnapshot {
  if (!value || value.type !== type || typeof value.revision !== 'string' || !value.revision || !Array.isArray(value.mapping)
    || !value.mapping.every(row => row && typeof row.cargo === 'string' && Array.isArray(row.estandares) && row.estandares.every(code => typeof code === 'string'))) {
    throw new Error('La API devolvió una matriz inválida o de otro tipo. No se descargaron datos.');
  }
  return value;
}
export function loadMatrix(type: MatrixType): Promise<MatrixSnapshot> {
  const existing = pending.get(type);
  if (existing) return existing;
  const request = apiRequest<MatrixSnapshot>(`matrices?type=${type}`).then(value => checkSnapshot(value, type)).finally(() => {
    if (pending.get(type) === request) pending.delete(type);
  });
  pending.set(type, request);
  return request;
}
export async function assignedCodes(type: MatrixType, cargo: string): Promise<string[]> {
  return codesForCargo((await loadMatrix(type)).mapping, cargo);
}
