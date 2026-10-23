import { PGlite } from '@electric-sql/pglite';

// public.intentos with the same columns, types and NOT NULL constraints as the Neon test branch
// (read from information_schema, 22-10-2026). NOT a production migration: test fixtures only.
export const INTENTOS_DDL = `CREATE TABLE public.intentos (
    id text PRIMARY KEY, tipo text NOT NULL, fecha timestamptz NOT NULL, nombre text NOT NULL, dni text NOT NULL,
    unidad_negocio text, disciplina text, cargo text NOT NULL, estandar_codigo text NOT NULL, estandar_nombre text NOT NULL,
    intento_num integer NOT NULL, puntaje integer NOT NULL, total_preguntas integer NOT NULL, respuestas jsonb NOT NULL);`;

// In-memory PostgreSQL used by tests and by the isolated browser check, so no fictitious result
// is ever written to Neon. It runs one query at a time: real concurrency is checked separately
// (scripts/verify-concurrency.mjs) on a temporary PostgreSQL server.
export async function createResultsDb() {
  const db = new PGlite();
  await db.exec(INTENTOS_DDL);
  return db;
}
