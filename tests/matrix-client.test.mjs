import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

test('matrix client deduplicates in-flight page reads, refreshes subsequent visits and fails closed offline', async () => {
  const source = await readFile(new URL('../src/utils/matrices.ts', import.meta.url), 'utf8');
  const apiUrl = 'data:text/javascript;base64,' + Buffer.from('export const apiRequest = (...args) => globalThis.matrixMockApi(...args);').toString('base64');
  const sharedUrl = new URL('../shared/matrices.mjs', import.meta.url).href;
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    .replace("from './api'", `from '${apiUrl}'`).replace("from '../../shared/matrices.mjs'", `from '${sharedUrl}'`);
  const client = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  let requests = 0, release;
  const response = { type: 'nuevo-ingreso', revision: '1', mapping: [{ cargo: 'Supervisor', estandares: ['A'] }] };
  globalThis.matrixMockApi = () => { requests++; return new Promise(resolve => { release = () => resolve(response); }); };
  const first = client.loadMatrix('nuevo-ingreso'), samePage = client.loadMatrix('nuevo-ingreso');
  assert.equal(requests, 1); assert.equal(first, samePage);
  release(); await Promise.all([first, samePage]);
  globalThis.matrixMockApi = async path => {
    requests++; return { ...response, type: path.includes('personal-antiguo') ? 'personal-antiguo' : 'nuevo-ingreso', revision: '2', mapping: [{ cargo: 'Supervisor', estandares: [path.includes('personal-antiguo') ? 'B' : 'C'] }] };
  };
  assert.deepEqual(await client.assignedCodes('nuevo-ingreso', 'Supervisor'), ['C']);
  assert.deepEqual(await client.assignedCodes('personal-antiguo', 'Supervisor'), ['B']);
  assert.deepEqual(await client.assignedCodes('personal-antiguo', 'Desconocido'), []);
  globalThis.matrixMockApi = async () => { throw new Error('offline'); };
  await assert.rejects(client.assignedCodes('nuevo-ingreso', 'Supervisor'), /offline/);
  await assert.rejects(client.assignedCodes('personal-antiguo', 'Supervisor'), /offline/);
  globalThis.matrixMockApi = async () => response;
  assert.deepEqual(await client.assignedCodes('nuevo-ingreso', 'Supervisor'), ['A']);
  await assert.rejects(client.loadMatrix('personal-antiguo'), /otro tipo/);
  globalThis.matrixMockApi = async () => ({});
  await assert.rejects(client.loadMatrix('nuevo-ingreso'), /matriz inválida/);
  delete globalThis.matrixMockApi;
});
