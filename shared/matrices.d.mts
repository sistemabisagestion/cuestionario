export interface MatrixLink { cargo: string; estandares: string[] }
export interface Validation { mapping: MatrixLink[]; errors: string[]; count: number }
export const MATRIX_TYPES: readonly string[];
export const MAX_ASSIGNMENTS: number;
export function normalizeCargo(value: string): string;
export function codesForCargo(mapping: MatrixLink[], cargo: string): string[];
export function validateRows(rows: unknown, validCodes: string[]): Validation;
export function validateMapping(mapping: unknown, validCodes: string[]): Validation;
