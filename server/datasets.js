import XLSX from 'xlsx-js-style';
import codes from '../shared/standard-codes.json' with { type: 'json' };
import { DATASETS, DATASET_MODULES, MATRIX_LABELS, isMatrixModule, toRows, fromRows, rowLabel, countOf, normalizeRows, diffRows, checkDataset } from '../shared/datasets.mjs';
import { MAX_ASSIGNMENTS, validateMapping } from '../shared/matrices.mjs';
import { DEFAULT_QUESTIONS, DEFAULT_LINKS } from '../shared/default-datasets.mjs';
import { readTableWorkbook } from '../shared/excel-tables.mjs';
import { requireAdmin } from './auth.js';
import { HttpError } from './http.js';
import { configuredMatrixStore } from './matrix-store.js';
import { datasetConflict, newVersionId } from './dataset-store.js';

// Versions are immutable, so a warm instance can keep them in memory by id.
const versionCache = new Map();
const unavailable = () => new HttpError(503, 'Almacenamiento de datos sin habilitar: no se pueden publicar cambios. Consulta README.md.', 'STORAGE_DISABLED');

function checkModule(module) {
  if (!DATASET_MODULES.includes(module)) throw new HttpError(400, 'Módulo de datos inválido.');
  return module;
}
// Fails closed on corrupt stored data instead of serving partial or foreign content.
function checkStoredData(module, data) {
  if (data === null || typeof data !== 'object') throw new Error('Invalid stored dataset');
  const rows = toRows(module, data);
  const result = normalizeRows(module, rows, {}, i => `Registro ${i + 1}`);
  if (result.errors.length || JSON.stringify(result.rows) !== JSON.stringify(rows)) throw new Error('Invalid stored dataset');
}

async function loadVersion(store, module, versionId) {
  const key = `${store.kind}:${module}/${versionId}`;
  if (versionCache.has(key)) return versionCache.get(key);
  const doc = await store.readVersion(module, versionId);
  if (!doc || doc.schema !== 2 || doc.module !== module || doc.versionId !== versionId) throw new Error('Missing or invalid dataset version');
  checkStoredData(module, doc.data);
  versionCache.set(key, doc);
  return doc;
}

// Starting point before the first publication of each module (no write on read).
async function baseline(module) {
  if (module === 'preguntas') return { versionId: 'inicial-incluida', source: 'incluida', updatedAt: null, data: DEFAULT_QUESTIONS };
  if (module === 'links') return { versionId: 'inicial-incluida', source: 'incluida', updatedAt: null, data: DEFAULT_LINKS };
  // Matrices: the existing (legacy) document stays untouched and acts as the initial version.
  const legacy = await (await configuredMatrixStore()).read(module);
  if (!legacy) return { versionId: 'matriz-vacia', source: 'vacia', updatedAt: null, data: [] };
  const doc = legacy.document;
  if (doc.schema !== 1 || !doc.current || typeof doc.current.revision !== 'string' || !doc.current.revision || validateMapping(doc.current.mapping, codes).errors.length) throw new Error('Invalid stored matrix');
  return { versionId: `legado-${doc.current.revision.replace(/[^0-9A-Za-z-]/g, '-').slice(0, 60)}`, source: 'legado', updatedAt: doc.current.updatedAt ?? null, data: doc.current.mapping };
}

export async function activeDataset(module, store) {
  checkModule(module);
  const manifest = store ? await store.readManifest(module) : null;
  if (!manifest) return { ...(await baseline(module)), manifest: null };
  const m = manifest.document;
  if (m?.schema !== 2 || m.module !== module || typeof m.active !== 'string' || !Array.isArray(m.history)) throw new Error('Invalid dataset manifest');
  const doc = await loadVersion(store, module, m.active);
  return { versionId: doc.versionId, source: 'publicada', updatedAt: doc.createdAt, data: doc.data, manifest };
}

// Relations between modules: links and matrices must reference standards of the published
// question bank, and the bank cannot drop a standard that other modules still use.
async function validationContext(module, store) {
  if (module !== 'preguntas') {
    const bank = await activeDataset('preguntas', store);
    return { codes: bank.data.map(est => est.estandar_codigo) };
  }
  const references = new Map();
  const add = (code, label) => references.set(code, [...new Set([...(references.get(code) ?? []), label])]);
  for (const type of Object.keys(MATRIX_LABELS)) {
    const matrix = await activeDataset(type, store).catch(error => { if (error.status === 503) return { data: [] }; throw error; });
    for (const row of matrix.data) for (const code of row.estandares) add(code, MATRIX_LABELS[type]);
  }
  for (const code of Object.keys((await activeDataset('links', store)).data)) add(code, 'Links de Estándares');
  return { references };
}

function decodeFile(module, file) {
  const spec = DATASETS[module];
  if (!file || typeof file.name !== 'string' || typeof file.base64 !== 'string') throw new HttpError(400, 'Adjunta un archivo Excel.');
  if (!/\.xlsx?$/i.test(file.name)) throw new HttpError(400, 'Usa un archivo de Excel (.xlsx).');
  if (file.base64.length > Math.ceil(spec.maxFileBytes / 3) * 4 + 4) throw new HttpError(413, `El archivo supera ${Math.round(spec.maxFileBytes / 1048576)} MB.`);
  const bytes = Buffer.from(file.base64, 'base64');
  const parsed = (() => {
    try { return readTableWorkbook(XLSX, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), spec); }
    catch (error) { throw new HttpError(400, error instanceof Error ? error.message : 'No se pudo leer el archivo Excel.', 'INVALID_FILE'); }
  })();
  return { input: parsed.rows, line: i => `Fila ${parsed.lines[i]}` };
}

async function prepare(module, store, body) {
  const mode = body.mode;
  if (mode !== 'parcial' && mode !== 'completa') throw new HttpError(400, 'Elige actualización parcial o sincronización completa.');
  const current = await activeDataset(module, store);
  const { input, line } = body.file ? decodeFile(module, body.file)
    : Array.isArray(body.rows) ? { input: body.rows, line: i => `Registro ${i + 1}` }
      : (() => { throw new HttpError(400, 'Adjunta un archivo Excel.'); })();
  const context = await validationContext(module, store);
  const normalized = normalizeRows(module, input, context, line);
  const diff = diffRows(module, toRows(module, current.data), normalized.rows, mode);
  const whole = checkDataset(module, diff.next, context);
  const errors = [...normalized.errors, ...whole.errors];
  if (!input.length) errors.unshift('El archivo no contiene registros.');
  if (isMatrixModule(module) && diff.next.length > MAX_ASSIGNMENTS) errors.push(`La matriz superaría ${MAX_ASSIGNMENTS} asignaciones.`);
  if (isMatrixModule(module) && !diff.next.length) errors.push('La matriz quedaría vacía. Usa Limpiar matriz si es lo que deseas.');
  return { mode, current, diff, received: input.length, errors, warnings: [...normalized.warnings, ...whole.warnings] };
}

function changedFields(module, before, after) {
  return DATASETS[module].columns.filter(column => JSON.stringify(before[column.key]) !== JSON.stringify(after[column.key])).map(column => column.header);
}
function previewView(module, p) {
  const sample = 15;
  return {
    module, mode: p.mode, base: p.current.versionId, valid: p.errors.length === 0,
    counts: { received: p.received, added: p.diff.added.length, modified: p.diff.modified.length, removed: p.diff.removed.length, unchanged: p.diff.unchanged, total: p.diff.next.length },
    changes: {
      added: p.diff.added.slice(0, sample).map(row => rowLabel(module, row)),
      modified: p.diff.modified.slice(0, sample).map(change => ({ label: rowLabel(module, change.after), fields: changedFields(module, change.before, change.after) })),
      removed: p.diff.removed.slice(0, sample).map(row => rowLabel(module, row)),
    },
    errors: p.errors.slice(0, 50), totalErrors: p.errors.length,
    warnings: p.warnings.slice(0, 30), totalWarnings: p.warnings.length,
  };
}

const metaOf = doc => ({ versionId: doc.versionId, createdAt: doc.createdAt, createdBy: doc.createdBy, action: doc.action, count: doc.count, summary: doc.summary, basedOn: doc.basedOn, ...(doc.restoredFrom ? { restoredFrom: doc.restoredFrom } : {}) });
function publicView(module, active) {
  return { module, version: active.versionId, updatedAt: active.updatedAt, source: active.source, count: countOf(module, active.data), data: active.data };
}

// Writes the new immutable version, then swaps the manifest with compare-and-swap.
// The first publication also stores the starting point so it can always be restored.
async function commit(module, store, current, data, details) {
  const now = new Date();
  // Re-read with the ETag used for compare-and-swap; it must still be the reviewed version.
  const latest = await store.readManifestForUpdate(module);
  if (!!latest !== !!current.manifest || (latest && latest.document.active !== current.versionId)) throw datasetConflict();
  const history = latest ? [...latest.document.history] : [];
  if (!latest) {
    const initial = { schema: 2, module, versionId: current.versionId, createdAt: current.updatedAt ?? now.toISOString(), createdBy: 'sistema',
      action: current.source === 'legado' ? 'version-existente' : current.source === 'vacia' ? 'matriz-vacia' : 'version-incluida',
      count: countOf(module, current.data), summary: null, basedOn: null, data: current.data };
    // A previous attempt may already have stored this same starting point.
    try { await store.writeVersion(module, initial.versionId, initial); } catch (error) { if (error.status !== 409) throw error; }
    history.push(metaOf(initial));
  }
  const doc = { schema: 2, module, versionId: newVersionId(now), createdAt: now.toISOString(), createdBy: 'administrador',
    action: details.action, count: countOf(module, data), summary: details.summary, basedOn: current.versionId,
    ...(details.restoredFrom ? { restoredFrom: details.restoredFrom } : {}), data };
  await store.writeVersion(module, doc.versionId, doc);
  try {
    await store.writeManifest(module, { schema: 2, module, active: doc.versionId, updatedAt: doc.createdAt, history: [...history, metaOf(doc)] }, latest?.etag ?? null);
  } catch (error) {
    // A retried request can report failure after the swap was stored: check before reporting it.
    const stored = await store.readManifest(module).catch(() => null);
    if (stored?.document.active !== doc.versionId) throw error;
  }
  versionCache.set(`${store.kind}:${module}/${doc.versionId}`, doc);
  return { ...publicView(module, { versionId: doc.versionId, updatedAt: doc.createdAt, source: 'publicada', data }), action: doc.action, summary: doc.summary };
}
const summaryOf = diff => ({ added: diff.added.length, modified: diff.modified.length, removed: diff.removed.length, unchanged: diff.unchanged });
function checkBase(current, base) { if (base !== current.versionId) throw datasetConflict(); }

export async function handleDatasets(req, store) {
  if (req.method === 'GET') {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const module = checkModule(params.get('module'));
    if (params.get('view') === 'versions') {
      requireAdmin(req);
      const current = await activeDataset(module, store);
      const history = current.manifest ? current.manifest.document.history : [{ versionId: current.versionId, createdAt: current.updatedAt, createdBy: 'sistema', action: current.source, count: countOf(module, current.data), summary: null, basedOn: null }];
      return { module, active: current.versionId, storage: store ? store.kind : 'deshabilitado', versions: [...history].reverse() };
    }
    const current = await activeDataset(module, store);
    // A specific published version (immutable), e.g. to resume an evaluation started with it.
    const requested = params.get('version');
    if (requested && requested !== current.versionId) {
      if (!store || !current.manifest?.document.history.some(entry => entry.versionId === requested)) throw new HttpError(404, 'La versión solicitada no existe para este módulo.', 'VERSION_NOT_FOUND');
      const doc = await loadVersion(store, module, requested);
      return publicView(module, { versionId: doc.versionId, updatedAt: doc.createdAt, source: 'historica', data: doc.data });
    }
    // Clients send the version they already hold; unchanged data is not transferred again.
    if (params.get('known') === current.versionId) return { module, version: current.versionId, unchanged: true };
    return publicView(module, current);
  }

  requireAdmin(req);
  const module = checkModule(req.body.module);
  const action = req.body.action;
  if (action === 'preview') return previewView(module, await prepare(module, store, req.body));
  if (!store) throw unavailable();
  if (action === 'publish') {
    const p = await prepare(module, store, req.body);
    if (p.errors.length) throw new HttpError(400, `No se publicó: ${p.errors.slice(0, 5).join(' ')}${p.errors.length > 5 ? ` (y ${p.errors.length - 5} errores más)` : ''}`, 'INVALID_FILE');
    checkBase(p.current, req.body.base);
    if (p.mode === 'completa' && p.diff.removed.length && req.body.confirmDeletions !== p.diff.removed.length) {
      throw new HttpError(400, `Confirma la eliminación de ${p.diff.removed.length} registros antes de publicar.`, 'CONFIRM_DELETIONS');
    }
    if (!p.diff.added.length && !p.diff.modified.length && !p.diff.removed.length) return { ...publicView(module, p.current), unchanged: true };
    return commit(module, store, p.current, fromRows(module, p.diff.next), { action: p.mode === 'completa' ? 'sincronizacion-completa' : 'actualizacion-parcial', summary: summaryOf(p.diff) });
  }
  if (action === 'restore') {
    const current = await activeDataset(module, store);
    checkBase(current, req.body.base);
    const target = req.body.versionId;
    if (typeof target !== 'string' || !current.manifest?.document.history.some(entry => entry.versionId === target)) throw new HttpError(404, 'La versión solicitada no existe para este módulo.');
    if (target === current.versionId) throw new HttpError(400, 'Esa versión ya es la vigente.');
    const doc = await loadVersion(store, module, target);
    const context = await validationContext(module, store);
    const rows = toRows(module, doc.data);
    const errors = [...normalizeRows(module, rows, context, i => `Registro ${i + 1}`).errors, ...checkDataset(module, rows, context).errors];
    if (errors.length) throw new HttpError(400, `La versión no se puede restaurar con los datos vigentes: ${errors.slice(0, 5).join(' ')}`, 'INVALID_VERSION');
    const diff = diffRows(module, toRows(module, current.data), rows, 'completa');
    return commit(module, store, current, doc.data, { action: 'restauracion', restoredFrom: target, summary: summaryOf(diff) });
  }
  if (action === 'clear') {
    if (!isMatrixModule(module)) throw new HttpError(400, 'Solo las matrices se pueden limpiar.');
    if (req.body.confirm !== true) throw new HttpError(400, 'Confirma la limpieza de la matriz.');
    const current = await activeDataset(module, store);
    checkBase(current, req.body.base);
    if (!current.data.length) return { ...publicView(module, current), unchanged: true };
    return commit(module, store, current, [], { action: 'limpieza', summary: { added: 0, modified: 0, removed: countOf(module, current.data), unchanged: 0 } });
  }
  throw new HttpError(400, 'Acción inválida.');
}
