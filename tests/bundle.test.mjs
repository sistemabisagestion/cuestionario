import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

test('built frontend has no database credentials, pg driver, Supabase client or password check', async () => {
  const directory = new URL('../dist/assets/', import.meta.url);
  const files = (await readdir(directory)).filter(name => name.endsWith('.js'));
  assert.ok(files.length > 0, 'Run npm run build before this check');
  // Real secrets are never written here: if they are present in the environment, their values are checked too.
  const secretValues = ['ADMIN_PASSWORD', 'SESSION_SECRET', 'DATABASE_URL', 'BLOB_READ_WRITE_TOKEN'].map(name => process.env[name]).filter(value => value && value.length >= 6);
  for (const file of files) {
    const source = await readFile(new URL(file, directory), 'utf8');
    for (const forbidden of ['postgresql://', 'postgres://', 'DATABASE_URL', 'SESSION_SECRET', 'ADMIN_PASSWORD', 'BLOB_READ_WRITE_TOKEN', 'VERCEL_OIDC_TOKEN', '@vercel/blob', 'supabase.co', 'supabase-js', 'node-postgres']) {
      assert.equal(source.includes(forbidden), false, `${file}: forbidden server dependency or credential marker ${forbidden}`);
    }
    // The administrator password is validated only on the server, never compared in the browser.
    assert.doesNotMatch(source, /password\s*===?\s*["'`]/i, `${file}: password compared with a literal`);
    for (const value of secretValues) assert.equal(source.includes(value), false, `${file}: contains the value of a server secret`);
  }
});
