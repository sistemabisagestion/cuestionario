import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const shared = name => new URL(`../../shared/${name}`, import.meta.url).href;
const sourceURL = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
async function compile(name, replacements = []) {
  const source = await readFile(new URL(`../../src/utils/${name}.ts`, import.meta.url), 'utf8');
  let js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const [from, to] of replacements) js = js.replaceAll(`'${from}'`, `'${to}'`);
  return sourceURL(js);
}
export async function frontendModules() {
  const apiURL = await compile('api');
  const matrixURL = await compile('matrices', [['./api', apiURL], ['../../shared/matrices.mjs', shared('matrices.mjs')]]);
  const datasetsURL = await compile('datasets', [['./api', apiURL]]);
  const tablesURL = await compile('excelTables', [
    ['./datasets', datasetsURL], ['../../shared/datasets.mjs', shared('datasets.mjs')], ['../../shared/excel-tables.mjs', shared('excel-tables.mjs')],
    ['exceljs', pathToFileURL(require.resolve('exceljs')).href],
  ]);
  return {
    api: await import(apiURL), matrices: await import(matrixURL), datasets: await import(datasetsURL),
    tables: await import(tablesURL),
  };
}
