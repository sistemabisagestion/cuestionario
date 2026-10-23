import { DATASETS, RESULTS_EXPORT, toRows } from '../../shared/datasets.mjs';
import { tableWorkbook, XLSX_TYPE } from '../../shared/excel-tables.mjs';
import type { TableSpec } from '../../shared/excel-tables.mjs';
import { loadDataset } from './datasets';
import type { DatasetModule, DatasetSnapshot } from './datasets';

export interface ExcelDownload { filename: string; bytes: ArrayBuffer; contentType: string }
export function saveInBrowser(file: ExcelDownload) {
  const url = URL.createObjectURL(new Blob([file.bytes], { type: file.contentType }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = file.filename;
  document.body.appendChild(anchor);
  try { anchor.click(); }
  finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

const today = () => new Date().toISOString().slice(0, 10);
// ExcelJS is loaded only when a download is requested.
export async function tableExcel(spec: TableSpec, rows: Record<string, unknown>[], filename: string): Promise<ExcelDownload> {
  const library = await import('exceljs');
  const ExcelJS = (library as { default?: unknown }).default ?? library;
  return { filename: `${filename}-${today()}.xlsx`, bytes: await tableWorkbook(ExcelJS, spec, rows), contentType: XLSX_TYPE };
}

// A failed API request never produces a file.
export async function downloadDatasetExcel<M extends DatasetModule>(module: M, save: (file: ExcelDownload) => void | Promise<void> = saveInBrowser): Promise<DatasetSnapshot<M>> {
  const current = await loadDataset(module);
  const spec = DATASETS[module];
  await save(await tableExcel(spec, toRows(module, current.data), spec.filename));
  return current;
}
export async function downloadResultsExcel(rows: Record<string, unknown>[], save: (file: ExcelDownload) => void | Promise<void> = saveInBrowser) {
  await save(await tableExcel(RESULTS_EXPORT, rows, RESULTS_EXPORT.filename));
}
