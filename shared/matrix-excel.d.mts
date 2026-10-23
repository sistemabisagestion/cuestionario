import type { MatrixLink } from './matrices.mjs';
import type * as XLSX from 'xlsx-js-style';
export function checkExcelContainer(buffer: ArrayBuffer, limits?: { maxBytes?: number; maxExpandedBytes?: number }): void;
export function matrixWorkbook(xlsx: typeof XLSX, mapping: MatrixLink[]): XLSX.WorkBook;
