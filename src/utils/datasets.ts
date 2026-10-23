import { apiRequest } from './api';
import type { Estandar } from '../types';
import type { MatrixLink } from '../../shared/matrices.mjs';

export type DatasetModule = 'preguntas' | 'links' | 'nuevo-ingreso' | 'personal-antiguo';
export interface EstandarLink { documento: string; video: string }
export interface DatasetTypes {
  preguntas: Estandar[];
  links: Record<string, EstandarLink>;
  'nuevo-ingreso': MatrixLink[];
  'personal-antiguo': MatrixLink[];
}
export interface DatasetSnapshot<M extends DatasetModule = DatasetModule> {
  module: M; version: string; updatedAt: string | null; source: string; count: number; data: DatasetTypes[M];
}
export type UpdateMode = 'parcial' | 'completa';
export interface DatasetPreview {
  module: DatasetModule; mode: UpdateMode; base: string; valid: boolean;
  counts: { received: number; added: number; modified: number; removed: number; unchanged: number; total: number };
  changes: { added: string[]; modified: { label: string; fields: string[] }[]; removed: string[] };
  errors: string[]; totalErrors: number; warnings: string[]; totalWarnings: number;
}
export interface DatasetVersion {
  versionId: string; createdAt: string | null; createdBy: string; action: string; count: number;
  summary: { added: number; modified: number; removed: number; unchanged: number } | null; restoredFrom?: string;
}
export interface PublishResult { version: string; count: number; unchanged?: boolean; summary?: DatasetVersion['summary'] }

// The last published version seen in this tab. Every read asks the server which version is
// active (`known`), so all users converge on the same version without re-downloading it.
const cache = new Map<DatasetModule, DatasetSnapshot>();
const pending = new Map<DatasetModule, Promise<DatasetSnapshot>>();
export function loadDataset<M extends DatasetModule>(module: M): Promise<DatasetSnapshot<M>> {
  const existing = pending.get(module);
  if (existing) return existing as Promise<DatasetSnapshot<M>>;
  const known = cache.get(module);
  const request = apiRequest<DatasetSnapshot | { module: string; version: string; unchanged: true }>(
    `datos?module=${module}${known ? `&known=${encodeURIComponent(known.version)}` : ''}`,
  ).then(value => {
    if (value.module !== module || typeof value.version !== 'string') throw new Error('La API devolvió datos de otro módulo.');
    if ('unchanged' in value && known && value.version === known.version) return known;
    if (!('data' in value) || value.data === null || typeof value.data !== 'object') throw new Error('La API devolvió datos inválidos.');
    cache.set(module, value);
    return value;
  }).finally(() => { if (pending.get(module) === request) pending.delete(module); });
  pending.set(module, request);
  return request as Promise<DatasetSnapshot<M>>;
}
function remember(module: DatasetModule) { cache.delete(module); }

// An exact published version (versions never change once published).
const versions = new Map<string, Promise<DatasetSnapshot>>();
export function loadDatasetVersion<M extends DatasetModule>(module: M, version: string): Promise<DatasetSnapshot<M>> {
  const known = cache.get(module);
  if (known?.version === version) return Promise.resolve(known as DatasetSnapshot<M>);
  const key = `${module}@${version}`;
  if (!versions.has(key)) {
    const request = apiRequest<DatasetSnapshot>(`datos?module=${module}&version=${encodeURIComponent(version)}`).then(value => {
      if (value.module !== module || value.version !== version || !value.data) throw new Error('La API devolvió otra versión de los datos.');
      return value;
    });
    request.catch(() => versions.delete(key));
    versions.set(key, request);
  }
  return versions.get(key) as Promise<DatasetSnapshot<M>>;
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
export type UploadSource = { file: File } | { rows: Record<string, unknown>[] };
async function source(input: UploadSource) {
  return 'file' in input ? { file: { name: input.file.name, base64: await fileToBase64(input.file) } } : { rows: input.rows };
}
const post = <T>(body: Record<string, unknown>) => apiRequest<T>('datos', { method: 'POST', body: JSON.stringify(body) });

// Validation and comparison happen on the server; nothing is published by a preview.
export async function previewDataset(module: DatasetModule, input: UploadSource, mode: UpdateMode): Promise<DatasetPreview> {
  return post<DatasetPreview>({ module, action: 'preview', mode, ...(await source(input)) });
}
export async function publishDataset(module: DatasetModule, input: UploadSource, mode: UpdateMode, base: string, confirmDeletions?: number): Promise<PublishResult> {
  const result = await post<PublishResult>({ module, action: 'publish', mode, base, confirmDeletions, ...(await source(input)) });
  remember(module);
  return result;
}
export async function restoreDataset(module: DatasetModule, versionId: string, base: string): Promise<PublishResult> {
  const result = await post<PublishResult>({ module, action: 'restore', versionId, base });
  remember(module);
  return result;
}
export async function clearMatrix(module: 'nuevo-ingreso' | 'personal-antiguo', base: string): Promise<PublishResult> {
  const result = await post<PublishResult>({ module, action: 'clear', base, confirm: true });
  remember(module);
  return result;
}
export function listVersions(module: DatasetModule) {
  return apiRequest<{ module: string; active: string; storage: string; versions: DatasetVersion[] }>(`datos?module=${module}&view=versions`);
}
