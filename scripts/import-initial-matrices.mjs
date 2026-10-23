// Dry-run does not contact Blob. --apply --authorize-blob explicitly opts in.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { MATRIX_TYPES } from '../shared/matrices.mjs';
import { validateInitialDocuments, seedMissingMatrices } from '../server/matrix-bootstrap.js';
import { configuredMatrixStore } from '../server/matrix-store.js';

const args = process.argv.slice(2);
const sourceIndex = args.indexOf('--source');
if (sourceIndex < 0 || !args[sourceIndex + 1]) throw new Error('Indica --source DIRECTORIO_DE_RECUPERACION. Sin --apply no se accede a Blob.');
const source = resolve(args[sourceIndex + 1]);
const report = JSON.parse(await readFile(join(source, 'recovery-report.json'), 'utf8'));
if (report.validated !== true) throw new Error('La recuperación no está validada.');
const documents = {};
for (const type of MATRIX_TYPES) {
  const bytes = await readFile(join(source, `matriz-${type}.json`));
  if (createHash('sha256').update(bytes).digest('hex') !== report.artifacts[type].jsonSha256) throw new Error(`El archivo inicial cambió desde su validación: ${type}`);
  documents[type] = JSON.parse(bytes.toString());
}
validateInitialDocuments(documents);
if (!args.includes('--apply')) {
  console.log('Simulación local validada. Sin acceso a Blob. Se crearán únicamente recursos inexistentes; los existentes siempre se conservarán.');
} else {
  if (!args.includes('--authorize-blob') || process.env.MATRICES_STORAGE !== 'blob' || process.env.MATRICES_BLOB_APPROVED !== 'true') throw new Error('La importación requiere autorización explícita --authorize-blob y configuración Blob aprobada.');
  const backup = join(source, 'blob-imports', randomUUID());
  await mkdir(backup, { recursive: true });
  // Preserve the exact approved initial payloads before any remote operation.
  for (const type of MATRIX_TYPES) await writeFile(join(backup, `${type}-initial.json`), JSON.stringify(documents[type], null, 2), { flag: 'wx' });
  await writeFile(join(backup, 'source-report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  const store = await configuredMatrixStore();
  const result = await seedMissingMatrices(store, documents, async (type, document) => writeFile(join(backup, `${type}-existing.json`), JSON.stringify(document, null, 2), { flag: 'wx' }));
  await writeFile(join(backup, 'result.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(result));
}
