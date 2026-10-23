
import { HttpError } from './http.js';
import { authorize, validateDni } from './auth.js';
import { startAttempt, checkAttemptTime } from './attempt-clock.js';

// Rule in force: at most two attempts per participant and evaluation (estandar_codigo; Nuevo
// Ingreso uses EVALUACION-GLOBAL), counted from the stored records. Enforced here, not only in
// the browser. Existing records are never modified to apply it.
export const MAX_ATTEMPTS = 2;
const maxAttemptsReached = () => new HttpError(409, `Ya realizaste los ${MAX_ATTEMPTS} intentos permitidos para esta evaluación.`, 'MAX_ATTEMPTS_REACHED');
async function countAttempts(db, dni, estandarCodigo) {
  return (await db.query('SELECT count(*)::int AS n FROM public.intentos WHERE dni = $1 AND estandar_codigo = $2', [dni, estandarCodigo])).rows[0].n;
}
// pg.Pool (Neon) and PGlite (tests) expose transactions differently.
async function withTransaction(db, action) {
  if (typeof db.transaction === 'function') return db.transaction(action);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

// Columnas reales de public.intentos en Neon.
// La columna "correo" no existe en la tabla migrada.
export const columns = [
  'id',
  'dni',
  'nombre',
  'unidad_negocio',
  'disciplina',
  'cargo',
  'estandar_codigo',
  'estandar_nombre',
  'fecha',
  'puntaje',
  'total_preguntas',
  'respuestas',
  'tipo',
  'intento_num',
];

// jsonb reorders object keys: compare results independently of key order.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

export function validateIntento(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new HttpError(400, 'Intento inválido');
  }

  validateDni(row.dni);

  for (const field of [
    'id',
    'nombre',
    'estandar_codigo',
    'estandar_nombre',
    'cargo',
    'fecha',
  ]) {
    if (
      typeof row[field] !== 'string' ||
      !row[field] ||
      row[field].length > 2000
    ) {
      throw new HttpError(400, `Campo inválido: ${field}`);
    }
  }

  // Se acepta "correo" por compatibilidad con el formulario,
  // pero no se almacena porque no existe en el esquema real.
  for (const field of [
    'correo',
    'unidad_negocio',
    'disciplina',
    'tipo',
  ]) {
    if (
      row[field] !== undefined &&
      (typeof row[field] !== 'string' || row[field].length > 2000)
    ) {
      throw new HttpError(400, `Campo inválido: ${field}`);
    }
  }

  if (
    !Number.isFinite(Date.parse(row.fecha)) ||
    !Number.isFinite(row.puntaje) ||
    row.puntaje < 0 ||
    row.puntaje > 20 ||
    !Number.isInteger(row.total_preguntas) ||
    row.total_preguntas < 1 ||
    row.total_preguntas > 200 ||
    !Array.isArray(row.respuestas) ||
    row.respuestas.length > row.total_preguntas ||
    (
      row.intento_num !== undefined &&
      (
        !Number.isInteger(row.intento_num) ||
        row.intento_num < 1
      )
    )
  ) {
    throw new HttpError(400, 'Resultados inválidos');
  }
}

export async function handleIntentos(req, db) {
  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');

    const dni = url.searchParams.get('dni');
    const code = url.searchParams.get('estandar_codigo');

    if (dni !== null) {
      validateDni(dni);
    }

    authorize(req, dni);

    const params = [];
    const filters = [];

    if (dni) {
      params.push(dni);
      filters.push(`dni = $${params.length}`);
    }

    if (code) {
      params.push(code);
      filters.push(`estandar_codigo = $${params.length}`);
    }

    const whereClause = filters.length
      ? ` WHERE ${filters.join(' AND ')}`
      : '';

    const sql = `
      SELECT ${columns.join(', ')}
      FROM public.intentos
      ${whereClause}
      ORDER BY fecha DESC
    `;

    const { rows } = await db.query(sql, params);

    return rows;
  }

  // Inicio de una evaluación: el servidor comprueba el límite, asigna el id y fija la hora de inicio.
  if (req.body.accion === 'iniciar') {
    const { dni, estandar_codigo: codigo, intento_num: expected } = req.body;
    validateDni(dni);
    authorize(req, dni);
    if (typeof codigo !== 'string' || !codigo || codigo.length > 2000) throw new HttpError(400, 'Campo inválido: estandar_codigo');
    const previous = await countAttempts(db, dni, codigo);
    if (previous >= MAX_ATTEMPTS) throw maxAttemptsReached();
    // The page prepared its questions for a given attempt number (10 or 20 questions).
    if (expected !== undefined && expected !== previous + 1) {
      throw new HttpError(409, 'La cantidad de intentos registrados cambió. Vuelve a abrir el estándar.', 'ATTEMPT_COUNT_CHANGED');
    }
    return { ...startAttempt(dni, codigo, req.body.total_preguntas), intento_num: previous + 1 };
  }

  // Inserción o actualización de un intento.
  const row = req.body;

  validateIntento(row);
  authorize(req, row.dni);
  // Un resultado final (con respuestas) debe llegar dentro del tiempo del intento.
  const final = row.respuestas.length > 0;
  if (final) checkAttemptTime(row);

  // Solo incluir campos existentes en la tabla y presentes
  // en la solicitud.
  const fields = columns.filter(
    (key) => row[key] !== undefined
  );

  // One participant + evaluation at a time: concurrent starts cannot create a third attempt.
  return withTransaction(db, async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`intentos|${row.dni}|${row.estandar_codigo}`]);
    const existing = (await tx.query('SELECT dni, estandar_codigo, puntaje, respuestas FROM public.intentos WHERE id = $1 FOR UPDATE', [row.id])).rows[0];

    if (!existing) {
      const previous = await countAttempts(tx, row.dni, row.estandar_codigo);
      if (previous >= MAX_ATTEMPTS) throw maxAttemptsReached();
      // The attempt number comes from the stored records, not from the browser.
      const values = { ...row, respuestas: JSON.stringify(row.respuestas), intento_num: previous + 1 };
      const insertFields = fields.includes('intento_num') ? fields : [...fields, 'intento_num'];
      await tx.query(
        `INSERT INTO public.intentos (${insertFields.join(', ')}) VALUES (${insertFields.map((_, i) => `$${i + 1}`).join(', ')})`,
        insertFields.map((key) => values[key]),
      );
      return { ok: true };
    }

    // Nunca cambiar el identificador, el DNI ni la evaluación de un intento existente.
    if (existing.dni !== row.dni) {
      throw new HttpError(403, 'El intento pertenece a otro participante');
    }
    if (existing.estandar_codigo !== row.estandar_codigo) {
      throw new HttpError(409, 'El intento corresponde a otra evaluación.', 'ATTEMPT_MISMATCH');
    }
    // Solo se actualiza un intento en curso (sin respuestas): un resultado final no se sobrescribe.
    if (existing.respuestas.length === 0) {
      const updates = fields.filter((key) => !['id', 'dni', 'estandar_codigo', 'intento_num'].includes(key));
      await tx.query(
        `UPDATE public.intentos SET ${updates.map((key, i) => `${key} = $${i + 2}`).join(', ')} WHERE id = $1`,
        [row.id, ...updates.map((key) => (key === 'respuestas' ? JSON.stringify(row[key]) : row[key]))],
      );
      return { ok: true };
    }
    // Reenvío del mismo resultado (reintento de red) o guardado inicial tardío: sin cambios.
    const same = Number(existing.puntaje) === row.puntaje && JSON.stringify(canonical(existing.respuestas)) === JSON.stringify(canonical(row.respuestas));
    if (!final || same) return { ok: true, sinCambios: true };
    throw new HttpError(409, 'Este intento ya tiene un resultado final registrado; no se sobrescribe.', 'RESULT_ALREADY_FINAL');
  });
}
