import { MAX_ASSIGNMENTS, normalizeCargo } from './matrices.mjs';

// Editable configuration modules. Excel is only the import/export format; the
// published source of truth is the validated JSON version of each module.
const option = letter => ({ header: `Opción ${letter}`, key: letter.toLowerCase(), width: 40, wrap: true });
export const DATASETS = {
  preguntas: {
    title: 'Banco de Preguntas', sheet: 'Preguntas', table: 'TablaPreguntas', filename: 'bisa-preguntas', maxRows: 6000, maxFileBytes: 3 * 1048576,
    columns: [
      { header: 'Código Estándar', key: 'codigo', width: 20 }, { header: 'Nombre Estándar', key: 'nombre', width: 40, wrap: true },
      { header: 'ID Pregunta', key: 'id', width: 12 }, { header: 'Categoría', key: 'categoria', width: 22, wrap: true },
      { header: 'Pregunta', key: 'pregunta', width: 60, wrap: true }, option('A'), option('B'), option('C'), option('D'), option('E'),
      { header: 'Respuesta Correcta', key: 'respuesta', width: 18 },
    ],
  },
  links: {
    title: 'Links de Estándares', sheet: 'Links', table: 'TablaLinks', filename: 'bisa-links', maxRows: 500, maxFileBytes: 1048576,
    columns: [{ header: 'Estandar', key: 'codigo', width: 20 }, { header: 'Link del documento', key: 'documento', width: 80 }, { header: 'Link del video', key: 'video', width: 80 }],
  },
  'nuevo-ingreso': {
    title: 'Matriz de Nuevo Ingreso', sheet: 'Matriz', table: 'TablaMatrizNuevoIngreso', filename: 'bisa-matriz-nuevo-ingreso', maxRows: MAX_ASSIGNMENTS, maxFileBytes: 1048576,
    columns: [{ header: 'Cargo', key: 'cargo', width: 35 }, { header: 'Estándar', key: 'estandar', width: 28 }],
  },
  'personal-antiguo': {
    title: 'Matriz de Personal Antiguo', sheet: 'Matriz', table: 'TablaMatrizPersonalAntiguo', filename: 'bisa-matriz-personal-antiguo', maxRows: MAX_ASSIGNMENTS, maxFileBytes: 1048576,
    columns: [{ header: 'Cargo', key: 'cargo', width: 35 }, { header: 'Estándar', key: 'estandar', width: 28 }],
  },
};
export const DATASET_MODULES = Object.keys(DATASETS);
export const isMatrixModule = module => module === 'nuevo-ingreso' || module === 'personal-antiguo';
export const MATRIX_LABELS = { 'nuevo-ingreso': 'Matriz de Nuevo Ingreso', 'personal-antiguo': 'Matriz de Personal Antiguo' };

// Results are read-only here (Neon); only their export shares the table format.
export const RESULTS_EXPORT = {
  sheet: 'Evaluaciones', table: 'TablaResultados', filename: 'bisa-evaluaciones',
  columns: [
    { header: 'Tipo', key: 'tipo', width: 18 }, { header: 'ID', key: 'id', width: 16 }, { header: 'Fecha', key: 'fecha', width: 20 },
    { header: 'Nombre', key: 'nombre', width: 28 }, { header: 'DNI', key: 'dni', width: 12 }, { header: 'Unidad Negocio', key: 'unidadNegocio', width: 20 },
    { header: 'Disciplina', key: 'disciplina', width: 22 }, { header: 'Cargo', key: 'cargo', width: 28 }, { header: 'Estándar', key: 'estandar', width: 30 },
    { header: 'Nombre Estándar', key: 'estandarNombre', width: 40 }, { header: 'Intento', key: 'intento', width: 10 }, { header: 'Nota', key: 'nota', width: 10 },
    { header: 'Total Preguntas', key: 'total', width: 16 }, { header: 'Estado', key: 'estado', width: 14 },
  ],
};

const ANSWERS = ['A', 'B', 'C', 'D', 'E'];
const CODE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const clean = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();

// ── Conversion between published JSON and flat rows (one row per Excel line) ──
export function toRows(module, data) {
  if (module === 'preguntas') return data.flatMap(est => est.preguntas.map(p => ({
    codigo: est.estandar_codigo, nombre: est.estandar_nombre, id: p.id, categoria: p.categoria, pregunta: p.pregunta,
    a: p.opcion_a, b: p.opcion_b, c: p.opcion_c, d: p.opcion_d, e: p.opcion_e, respuesta: p.respuesta_correcta,
  })));
  if (module === 'links') return Object.entries(data).map(([codigo, link]) => ({ codigo, documento: link.documento, video: link.video }));
  return data.flatMap(item => item.estandares.map(estandar => ({ cargo: item.cargo, estandar })));
}
export function fromRows(module, rows) {
  if (module === 'preguntas') {
    const grouped = new Map();
    for (const row of rows) {
      if (!grouped.has(row.codigo)) grouped.set(row.codigo, { estandar_codigo: row.codigo, estandar_nombre: row.nombre, preguntas: [] });
      grouped.get(row.codigo).preguntas.push({
        id: row.id, categoria: row.categoria, pregunta: row.pregunta, opcion_a: row.a, opcion_b: row.b, opcion_c: row.c,
        opcion_d: row.d, opcion_e: row.e, respuesta_correcta: row.respuesta,
      });
    }
    return [...grouped.values()];
  }
  if (module === 'links') return Object.fromEntries(rows.map(row => [row.codigo, { documento: row.documento, video: row.video }]));
  const grouped = new Map();
  for (const row of rows) {
    const key = normalizeCargo(row.cargo);
    if (!grouped.has(key)) grouped.set(key, { cargo: row.cargo, estandares: [] });
    grouped.get(key).estandares.push(row.estandar);
  }
  return [...grouped.values()];
}
export function rowKey(module, row) {
  if (module === 'preguntas') return `${row.codigo}#${row.id}`;
  if (module === 'links') return row.codigo;
  return `${normalizeCargo(row.cargo)}\u0000${row.estandar}`;
}
export function rowLabel(module, row) {
  if (module === 'preguntas') return `${row.codigo} · pregunta ${row.id}`;
  if (module === 'links') return row.codigo;
  return `${row.cargo} → ${row.estandar}`;
}
export const countOf = (module, data) => toRows(module, data).length;

function url(value, label, line, errors, warnings) {
  if (!value) return;
  let parsed;
  try { parsed = new URL(value); } catch { errors.push(`${line}: ${label} no es una URL válida.`); return; }
  if (parsed.protocol !== 'https:' || value.length > 2048) errors.push(`${line}: ${label} debe usar https y tener como máximo 2048 caracteres.`);
  else if (!/(^|\.)sharepoint\.com$/i.test(parsed.hostname)) warnings.push(`${line}: ${label} no apunta a SharePoint (${parsed.hostname}).`);
}

// Normalizes and validates incoming rows. `line(i)` names the Excel row in messages.
// context.codes: standard codes of the active question bank (links and matrices).
export function normalizeRows(module, input, context = {}, line = i => `Fila ${i + 2}`) {
  const spec = DATASETS[module];
  const errors = [], warnings = [], rows = [], seen = new Set();
  if (!Array.isArray(input)) return { rows, errors: ['Datos inválidos.'], warnings };
  if (input.length > spec.maxRows) return { rows, errors: [`Máximo ${spec.maxRows} registros por archivo.`], warnings };
  const codes = context.codes ? new Set(context.codes) : null;
  input.forEach((raw, index) => {
    const at = line(index);
    if (!raw || typeof raw !== 'object') { errors.push(`${at}: registro inválido.`); return; }
    let row;
    if (module === 'preguntas') {
      row = { codigo: clean(raw.codigo).toUpperCase(), nombre: clean(raw.nombre), id: Number(clean(raw.id)), categoria: clean(raw.categoria), pregunta: clean(raw.pregunta),
        a: clean(raw.a), b: clean(raw.b), c: clean(raw.c), d: clean(raw.d), e: clean(raw.e), respuesta: clean(raw.respuesta).toUpperCase() };
      if (!CODE.test(row.codigo) || row.codigo.length > 40) errors.push(`${at}: código de estándar vacío o inválido.`);
      if (!row.nombre || row.nombre.length > 200) errors.push(`${at}: nombre de estándar vacío o mayor a 200 caracteres.`);
      if (!Number.isInteger(row.id) || row.id < 1 || row.id > 100000) errors.push(`${at}: ID de pregunta debe ser un entero positivo.`);
      if (!row.categoria || row.categoria.length > 120) errors.push(`${at}: categoría vacía o mayor a 120 caracteres.`);
      if (!row.pregunta || row.pregunta.length > 2000) errors.push(`${at}: pregunta vacía o mayor a 2000 caracteres.`);
      for (const letter of ANSWERS) {
        const text = row[letter.toLowerCase()];
        if (!text || text.length > 1000) errors.push(`${at}: opción ${letter} vacía o mayor a 1000 caracteres.`);
      }
      if (!ANSWERS.includes(row.respuesta)) errors.push(`${at}: la respuesta correcta debe ser A, B, C, D o E.`);
    } else if (module === 'links') {
      row = { codigo: clean(raw.codigo).toUpperCase(), documento: clean(raw.documento), video: clean(raw.video) };
      if (!CODE.test(row.codigo)) errors.push(`${at}: código de estándar vacío o inválido.`);
      else if (codes && !codes.has(row.codigo)) errors.push(`${at}: el estándar ${row.codigo} no existe en el Banco de Preguntas publicado.`);
      url(row.documento, 'Link del documento', at, errors, warnings);
      url(row.video, 'Link del video', at, errors, warnings);
      if (!row.documento && !row.video) warnings.push(`${at}: ${row.codigo} no tiene ningún link.`);
    } else {
      row = { cargo: clean(raw.cargo).replace(/\s+/g, ' '), estandar: clean(raw.estandar).toUpperCase() };
      if (!row.cargo || row.cargo.length > 120 || /[=<>@]/.test(row.cargo) || /^[+-]/.test(row.cargo)) errors.push(`${at}: cargo vacío o inválido (máximo 120 caracteres).`);
      if (!row.estandar) errors.push(`${at}: código de estándar vacío.`);
      else if (codes && !codes.has(row.estandar)) errors.push(`${at}: código inexistente en el Banco de Preguntas: ${row.estandar.slice(0, 60)}.`);
    }
    const key = rowKey(module, row);
    if (seen.has(key)) errors.push(`${at}: registro duplicado (${rowLabel(module, row)}).`);
    seen.add(key);
    rows.push(row);
  });
  return { rows, errors, warnings };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// mode 'parcial' upserts; 'completa' makes the file the whole new version.
export function diffRows(module, current, incoming, mode) {
  const before = new Map(current.map(row => [rowKey(module, row), row]));
  const after = new Map(incoming.map(row => [rowKey(module, row), row]));
  const added = [], modified = [], removed = [];
  let unchanged = 0;
  for (const [key, row] of after) {
    const old = before.get(key);
    if (!old) added.push(row);
    else if (same(old, row)) unchanged++;
    else modified.push({ before: old, after: row });
  }
  let next;
  if (mode === 'completa') {
    for (const [key, row] of before) if (!after.has(key)) removed.push(row);
    next = incoming;
  } else {
    next = current.map(row => after.get(rowKey(module, row)) ?? row).concat(added);
  }
  return { next, added, modified, removed, unchanged };
}

// Rules over the whole resulting version (not only the uploaded rows).
// context.references: Map code → [labels] of modules that use each standard.
export function checkDataset(module, rows, context = {}) {
  const errors = [], warnings = [];
  if (module === 'preguntas') {
    const names = new Map(), counts = new Map();
    for (const row of rows) {
      if (names.has(row.codigo) && names.get(row.codigo) !== row.nombre) errors.push(`El estándar ${row.codigo} tiene nombres distintos; usa el mismo nombre en todas sus preguntas.`);
      names.set(row.codigo, row.nombre);
      counts.set(row.codigo, (counts.get(row.codigo) ?? 0) + 1);
    }
    for (const [code, labels] of context.references ?? []) {
      if (!counts.has(code)) errors.push(`No se puede dejar sin preguntas a ${code}: lo usa ${labels.join(', ')}.`);
    }
    for (const [code, count] of counts) if (count < 20) warnings.push(`${code} tiene ${count} preguntas; el segundo intento utiliza 20.`);
    if (!rows.length) errors.push('El Banco de Preguntas no puede quedar vacío.');
  }
  return { errors: [...new Set(errors)], warnings };
}
