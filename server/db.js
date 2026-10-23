import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';

let pool;
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required on the server');
  if (!pool) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10000 });
    attachDatabasePool(pool);
  }
  return pool;
}
