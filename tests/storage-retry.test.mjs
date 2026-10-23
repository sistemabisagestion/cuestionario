import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryRead, logSafeMessage } from '../server/http.js';
import { blobDatasetStore } from '../server/dataset-store.js';
import { blobMatrixStore } from '../server/matrix-store.js';

class BlobNotFoundError extends Error {}
const found = value => {
  const text = JSON.stringify(value);
  return { statusCode: 200, stream: new Response(text).body, blob: { size: Buffer.byteLength(text), etag: '"e1"' } };
};
// Simulated SDK: the first `failures` reads throw a transient error, then the stored value is returned.
function flakySdk(value, failures) {
  const sdk = { BlobNotFoundError, calls: 0 };
  sdk.get = async () => {
    sdk.calls++;
    if (sdk.calls <= failures) throw new Error('Blob service temporarily unavailable');
    if (value === undefined) throw new BlobNotFoundError('not found');
    return found(value);
  };
  return sdk;
}

test('a transient Blob read failure is retried and the request succeeds', async () => {
  const manifest = { schema: 2, module: 'links', active: 'v1', history: [] };
  const datasets = flakySdk(manifest, 2);
  assert.deepEqual((await blobDatasetStore(datasets).readManifest('links')).document, manifest);
  assert.equal(datasets.calls, 3);
  const matrices = flakySdk({ schema: 1 }, 1);
  assert.deepEqual((await blobMatrixStore(matrices).read('nuevo-ingreso')).document, { schema: 1 });
  assert.equal(matrices.calls, 2);
});

test('"not found" is final (no retries) and a persistent failure still fails after three attempts', async () => {
  const missing = flakySdk(undefined, 0);
  assert.equal(await blobDatasetStore(missing).readManifest('links'), null);
  assert.equal(missing.calls, 1);
  const down = flakySdk({}, 99);
  await assert.rejects(blobDatasetStore(down).readManifest('links'), /temporarily unavailable/);
  assert.equal(down.calls, 3);
  let calls = 0;
  await assert.rejects(retryRead(async () => { calls++; throw new Error('x'); }, { delays: [1] }), /x/);
  assert.equal(calls, 3);
});

test('logged error text never includes URLs or connection strings', () => {
  const message = logSafeMessage(new Error('connect failed postgresql://user:secret@host/db and https://store.blob.vercel-storage.com/a?token=abc'));
  assert.ok(!/secret|token=|postgresql:\/\/|https:\/\//.test(message), message);
  assert.match(message, /<url>/);
  assert.ok(logSafeMessage(new Error('a'.repeat(500))).length <= 160);
});
