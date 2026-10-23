import { checkExcelContainer } from './matrix-excel.mjs';

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const NAVY = 'FF1D262B';

// Native Excel table (ListObject): filters, banded rows and frozen header.
// Styling the header cells only overrides colors; the table itself stays intact.
export async function tableWorkbook(ExcelJS, { sheet, table, columns }, rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BISAQUIZ';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(sheet, { views: [{ state: 'frozen', ySplit: 1 }] });
  const values = rows.map(row => columns.map(column => row[column.key] ?? ''));
  worksheet.addTable({
    name: table, ref: 'A1', headerRow: true, totalsRow: false,
    style: { theme: 'TableStyleMedium1', showRowStripes: true, showColumnStripes: false },
    columns: columns.map(column => ({ name: column.header, filterButton: true })),
    // Excel requires at least one data row in a table; an empty export keeps one blank row.
    rows: values.length ? values : [columns.map(() => null)],
  });
  columns.forEach((column, index) => {
    const target = worksheet.getColumn(index + 1);
    target.width = column.width;
    if (column.wrap) target.alignment = { wrapText: true, vertical: 'top' };
  });
  const header = worksheet.getRow(1);
  header.height = 22;
  header.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  return workbook.xlsx.writeBuffer();
}

const normalizeHeader = value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

// Server-side parsing of an uploaded workbook into rows keyed like the spec.
// Rejects macros, formulas, external links, wrong/missing/extra headers and oversize content.
export function readTableWorkbook(XLSX, buffer, spec) {
  checkExcelContainer(buffer, { maxBytes: spec.maxFileBytes, maxExpandedBytes: 16 * spec.maxFileBytes });
  const workbook = XLSX.read(buffer, { type: 'array', cellFormula: true, bookVBA: true, sheetRows: spec.maxRows + 2 });
  if (workbook.vbaraw) throw new Error('No se permiten archivos con macros.');
  const name = workbook.SheetNames.includes(spec.sheet) ? spec.sheet : workbook.SheetNames.length === 1 ? workbook.SheetNames[0] : null;
  if (!name) throw new Error(`Usa una sola hoja o una hoja llamada "${spec.sheet}".`);
  const sheet = workbook.Sheets[name];
  const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'] || 'A1');
  if (range.e.r > spec.maxRows) throw new Error(`Máximo ${spec.maxRows} registros.`);
  for (const [key, cell] of Object.entries(sheet)) {
    if (key.startsWith('!')) continue;
    if (cell.f) throw new Error(`No se permiten fórmulas (celda ${key}).`);
    // Excel turns typed URLs into hyperlinks; accept them only when the target is the visible text.
    if (cell.l && String(cell.l.Target ?? '').trim() !== String(cell.v ?? '').trim()) throw new Error(`La celda ${key} tiene un hipervínculo distinto de su texto.`);
  }
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true, blankrows: false });
  const header = (grid[0] ?? []).map(normalizeHeader);
  while (header.length && !header[header.length - 1]) header.pop();
  const expected = spec.columns.map(column => normalizeHeader(column.header));
  const missing = spec.columns.filter((_, i) => !header.includes(expected[i])).map(column => column.header);
  const extra = header.filter(value => value && !expected.includes(value));
  if (missing.length || extra.length || new Set(header).size !== header.length) {
    throw new Error(`Encabezados esperados: ${spec.columns.map(column => column.header).join(', ')}.${missing.length ? ` Faltan: ${missing.join(', ')}.` : ''}${extra.length ? ` No reconocidos: ${extra.join(', ')}.` : ''}`);
  }
  const index = expected.map(value => header.indexOf(value));
  const lines = [];
  const rows = [];
  grid.slice(1).forEach((cells, i) => {
    const row = Object.fromEntries(spec.columns.map((column, c) => [column.key, cells[index[c]] ?? '']));
    if (Object.values(row).every(value => String(value).trim() === '')) return; // blank or trailing table row
    rows.push(row);
    lines.push(i + 2);
  });
  return { rows, lines, sheet: name };
}
