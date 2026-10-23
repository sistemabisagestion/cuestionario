import assert from 'node:assert/strict';
import pg from 'pg';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error('Falta TEST_DATABASE_URL');
// Pin the endpoint created and verified for this migration; refuse production.
const target = new URL(connectionString);
if (target.hostname !== 'ep-nameless-hat-b5zjb2mk.c-7.us-east-2.aws.neon.tech') throw new Error('La conexión no corresponde a la rama de pruebas verificada');
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query('CREATE TEMP TABLE bisaquiz_migration_probe (id text PRIMARY KEY, puntaje numeric, respuestas jsonb) ON COMMIT DROP');
  await client.query('INSERT INTO bisaquiz_migration_probe (id, puntaje, respuestas) VALUES ($1, $2, $3)', ['probe', 0, '[]']);
  let row = (await client.query('SELECT puntaje FROM bisaquiz_migration_probe WHERE id = $1', ['probe'])).rows[0];
  assert.equal(Number(row.puntaje), 0);
  await client.query('UPDATE bisaquiz_migration_probe SET puntaje = $1, respuestas = $2 WHERE id = $3', [18, JSON.stringify([{ esCorrecta: true }]), 'probe']);
  row = (await client.query('SELECT puntaje, respuestas FROM bisaquiz_migration_probe WHERE id = $1', ['probe'])).rows[0];
  assert.equal(Number(row.puntaje), 18); assert.deepEqual(row.respuestas, [{ esCorrecta: true }]);
  await client.query('ROLLBACK');
  assert.equal((await client.query("SELECT to_regclass('pg_temp.bisaquiz_migration_probe') AS relation")).rows[0].relation, null);
  console.log('Neon pruebas: conexión TLS, lectura, inserción, actualización, JSON y rollback correctos en tabla temporal. No valida el esquema de public.intentos ni migra datos.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('La prueba Neon falló:', error.code ?? error.name);
  process.exitCode = 1;
} finally { await client.end(); }
