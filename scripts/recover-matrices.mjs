import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import XLSX from 'xlsx-js-style';
import { MATRIX_TYPES, validateMapping } from '../shared/matrices.mjs';
import { matrixWorkbook } from '../shared/matrix-excel.mjs';
import codes from '../shared/standard-codes.json' with { type: 'json' };
import { localMatrixStore } from '../server/matrix-store.js';
import { seedMissingMatrices } from '../server/matrix-bootstrap.js';

const exec = promisify(execFile);
const digest = value => createHash('sha256').update(value).digest('hex');
const stringify = value => JSON.stringify(value, null, 2) + '\n';
async function git(args) { return (await exec('git', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1048576 })).stdout; }

// Parse literals with TypeScript's AST; never execute recovered source code.
export function extractLiteral(source, variable) {
  const file = ts.createSourceFile('matrix.ts', source, ts.ScriptTarget.Latest, true);
  function value(node) {
    if (ts.isStringLiteral(node)) return node.text;
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(value);
    if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => {
      if (!ts.isPropertyAssignment(property)) throw new Error('Solo se permiten propiedades literales.');
      return [property.name.text, value(property.initializer)];
    }));
    throw new Error('La matriz contiene una expresión no literal.');
  }
  let result;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === variable) result = value(node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (!result) throw new Error(`No se encontró ${variable}.`);
  return result;
}
const staffMapping = source => Object.entries(extractLiteral(source, 'cargoEstandarMapping')).map(([cargo, estandares]) => ({ cargo, estandares }));
function pairs(mapping) { return mapping.flatMap(row => row.estandares.map(code => JSON.stringify([row.cargo, code]))); }
export function compareMappings(original, recovered) {
  const before = new Set(pairs(original)), after = new Set(pairs(recovered));
  return {
    exact: JSON.stringify(original) === JSON.stringify(recovered),
    missing: [...before].filter(pair => !after.has(pair)).map(JSON.parse),
    added: [...after].filter(pair => !before.has(pair)).map(JSON.parse),
    cargosOriginal: original.length, cargosRecovered: recovered.length,
    assignmentsOriginal: pairs(original).length, assignmentsRecovered: pairs(recovered).length,
  };
}

export async function recoverMatrices({ initializeLocal = false, directory = '.local-matrices' } = {}) {
  if (initializeLocal && (process.env.VERCEL || process.env.NODE_ENV === 'production')) throw new Error('La recuperación local no está permitida en producción.');
  const root = resolve(directory);
  const run = join(root, 'recovery', `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);
  await mkdir(join(run, 'backups'), { recursive: true });
  const write = (name, data) => writeFile(join(run, name), data, { flag: 'wx' });
  const nuevoSource = await readFile('src/data/nuevoIngresoMapping.ts', 'utf8');
  const staffSource = await readFile('src/data/index.ts', 'utf8');
  const gitStaff = await git(['show', 'HEAD:src/data/index.ts']);
  const archiveText = await readFile('shared/matrix-defaults.json', 'utf8');
  const archive = JSON.parse(archiveText);
  const sources = {
    'nuevo-ingreso': extractLiteral(nuevoSource, 'LEGACY_MATRIZ_NUEVO_INGRESO'),
    'personal-antiguo': staffMapping(gitStaff),
  };
  await write('backups/nuevo-ingreso-source.ts', nuevoSource);
  await write('backups/personal-antiguo-working-source.ts', staffSource);
  await write('backups/personal-antiguo-git-HEAD.ts', gitStaff);
  await write('backups/matrix-defaults.json', archiveText);
  // Preserve all existing local matrix JSON and previous Excel exports first.
  const priorFiles = (await readdir(root)).filter(name => /^(nuevo-ingreso|personal-antiguo)\.json$|^plantilla-.*\.xlsx$/.test(name));
  const backups = [];
  for (const name of priorFiles) {
    const bytes = await readFile(join(root, name));
    await copyFile(join(root, name), join(run, 'backups', name));
    backups.push({ file: name, sha256: digest(bytes) });
  }
  const report = {
    generatedAt: new Date().toISOString(), gitHead: (await git(['rev-parse', 'HEAD'])).trim(),
    history: (await git(['log', '--all', '--format=%h %s', '--', 'src/data/index.ts', 'src/data/nuevoIngresoMapping.ts'])).trim().split('\n'),
    sources: {
      'nuevo-ingreso': { origin: 'Literal LEGACY_MATRIZ_NUEVO_INGRESO en código local, corroborado con archivo archivado y Excel previo.', gitAvailable: false, sourceSha256: digest(nuevoSource) },
      'personal-antiguo': { origin: 'cargoEstandarMapping en Git HEAD, corroborado con código local, archivo archivado y Excel previo.', gitAvailable: true, sourceSha256: digest(gitStaff) },
    },
    localStorage: { status: 'not-accessible', key: 'bisa-nuevo-ingreso-mapping', note: 'No se tiene acceso al perfil del navegador. No se modificó ni eliminó esta clave. Posibles personalizaciones del navegador no se pueden confirmar.' },
    backups, comparisons: {}, artifacts: {}, initialization: [],
  };
  const documents = {};
  let valid = true;
  for (const type of MATRIX_TYPES) {
    const mapping = sources[type];
    const validation = validateMapping(mapping, codes);
    const comparisons = { archivedJSON: compareMappings(mapping, archive[type]) };
    if (type === 'personal-antiguo') comparisons.workingCode = compareMappings(mapping, staffMapping(staffSource));
    const oldExcel = `plantilla-${type}.xlsx`;
    if (priorFiles.includes(oldExcel)) {
      const workbook = XLSX.read(await readFile(join(run, 'backups', oldExcel)), { type: 'buffer' });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      const originalRows = mapping.flatMap(row => row.estandares.map(code => ({ Cargo: row.cargo, 'Estándar': code })));
      comparisons.previousExcel = { exact: JSON.stringify(rows) === JSON.stringify(originalRows), rows: rows.length };
    }
    report.comparisons[type] = { ...comparisons, validationErrors: validation.errors };
    if (validation.errors.length || Object.values(comparisons).some(value => !value.exact)) valid = false;
    const document = { schema: 1, current: { revision: randomUUID(), updatedAt: report.generatedAt, mapping }, previous: null };
    documents[type] = document;
    const json = stringify(document);
    const workbook = matrixWorkbook(XLSX, mapping);
    const excel = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    await write(`matriz-${type}.json`, json);
    await write(`matriz-${type}.xlsx`, excel);
    const reread = XLSX.read(excel, { type: 'buffer' });
    const excelRows = XLSX.utils.sheet_to_json(reread.Sheets.Matriz, { header: 1 });
    const exactExcel = JSON.stringify(excelRows) === JSON.stringify([['Cargo', 'Estándar'], ...mapping.flatMap(row => row.estandares.map(code => [row.cargo, code]))]);
    if (!exactExcel) valid = false;
    report.artifacts[type] = { json: `matriz-${type}.json`, excel: `matriz-${type}.xlsx`, jsonSha256: digest(json), excelSha256: digest(excel), cargos: mapping.length, assignments: validation.count, excelExact: exactExcel };
  }
  report.validated = valid;
  if (!valid) {
    await write('recovery-report.json', stringify(report));
    throw new Error(`Hay diferencias bloqueantes. No se inicializó ninguna matriz. Revisa ${run}/recovery-report.json`);
  }
  if (initializeLocal) report.initialization = await seedMissingMatrices(localMatrixStore(root), documents, async (type, doc) => write(`backups/${type}-preserved-on-import.json`, stringify(doc)));
  await write('recovery-report.json', stringify(report));
  const lines = ['# Recuperación de matrices originales BISAQUIZ', '', `Git HEAD: ${report.gitHead}`, '', 'Solo se usaron asignaciones presentes en el código original; no se copiaron datos entre matrices.', '', ...MATRIX_TYPES.map(type => {
    const artifact = report.artifacts[type];
    return `- ${type}: ${artifact.cargos} cargos, ${artifact.assignments} relaciones. Comparaciones exactas, sin altas, bajas ni cambios de códigos. Excel releído y comparado fila por fila.`;
  }), '', 'Personal Antiguo se cotejó contra Git HEAD. Nuevo Ingreso no está registrado en Git: se cotejó su literal local con el JSON archivado y el Excel previo.', '', 'No fue posible leer el localStorage del perfil del navegador. Sus personalizaciones, si existen, no están incluidas ni se eliminaron.', '', 'Los respaldos previos y las fuentes están en backups/. Las matrices existentes se conservan, incluso si están vacías por una limpieza administrativa.', '', `Inicialización local: ${JSON.stringify(report.initialization)}`, '', 'Ver recovery-report.json para hashes SHA-256, fuentes, historial Git y comparación exacta.'];
  await write('REPORTE.txt', lines.join('\n') + '\n');
  console.log(JSON.stringify({ directory: run, validated: valid, matrices: report.artifacts, initialization: report.initialization }, null, 2));
  return { directory: run, report, documents };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await recoverMatrices({ initializeLocal: process.argv.includes('--initialize-local') });
}
