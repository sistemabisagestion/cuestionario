import type { TableSpec } from './excel-tables.mjs';
import type { DatasetModule, DatasetTypes } from '../src/utils/datasets';
export interface DatasetSpec extends TableSpec { title: string; filename: string; maxRows: number; maxFileBytes: number }
export const DATASETS: Record<DatasetModule, DatasetSpec>;
export const DATASET_MODULES: DatasetModule[];
export const RESULTS_EXPORT: TableSpec & { filename: string };
export const MATRIX_LABELS: Record<'nuevo-ingreso' | 'personal-antiguo', string>;
export function isMatrixModule(module: string): module is 'nuevo-ingreso' | 'personal-antiguo';
export function toRows<M extends DatasetModule>(module: M, data: DatasetTypes[M]): Record<string, unknown>[];
export function fromRows<M extends DatasetModule>(module: M, rows: Record<string, unknown>[]): DatasetTypes[M];
export function rowKey(module: DatasetModule, row: Record<string, unknown>): string;
export function rowLabel(module: DatasetModule, row: Record<string, unknown>): string;
export function countOf<M extends DatasetModule>(module: M, data: DatasetTypes[M]): number;
