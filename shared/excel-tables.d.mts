export interface TableColumn { header: string; key: string; width: number; wrap?: boolean }
export interface TableSpec { sheet: string; table: string; columns: TableColumn[] }
export const XLSX_TYPE: string;
export function tableWorkbook(excel: unknown, spec: TableSpec, rows: Record<string, unknown>[]): Promise<ArrayBuffer>;
export function readTableWorkbook(xlsx: unknown, buffer: ArrayBuffer, spec: TableSpec & { maxRows: number; maxFileBytes: number }): { rows: Record<string, unknown>[]; lines: number[]; sheet: string };
