export interface ColumnInfo {
  name: string;
  index: number;
}

export interface CsvSchema {
  columns: ColumnInfo[];
  rowCount: number;
}

/** Returned by cmd_read_csv — schema, rows, and auto-detected hints in one. */
export interface CsvReadResult {
  schema: CsvSchema;
  rows: string[][];
  primaryKeyCandidates: string[];
  noiseColumns: string[];
}

export interface DiffConfig {
  primaryKeys: string[];
  ignoreColumns: string[];
  caseSensitive: boolean;
}

export interface SchemaDiff {
  addedColumns: ColumnInfo[];
  removedColumns: ColumnInfo[];
  commonColumns: ColumnInfo[];
}

export interface CellChange {
  column: string;
  valueA: string;
  valueB: string;
}

export interface ModifiedRow {
  keyValues: string[];
  rowIndexA: number;
  rowIndexB: number;
  changes: CellChange[];
}

export interface DiffResult {
  schemaDiff: SchemaDiff;
  addedRows: number[];
  deletedRows: number[];
  modifiedRows: ModifiedRow[];
  totalRowsA: number;
  totalRowsB: number;
  autoIgnoredColumns: string[];
}

export interface DiffSummary {
  added: number;
  deleted: number;
  modified: number;
  unchanged: number;
  totalA: number;
  totalB: number;
  hasSchemaChanges: boolean;
  schemaChangesCount: number;
}

export interface MergeConfig {
  primaryKeys: string[];
  outputPath: string | null;
}

export interface MergeResult {
  totalRows: number;
  rowsFromA: number;
  rowsFromB: number;
  outputCsv: string;
}

// "fileA" | "fileB" matches #[serde(rename_all = "camelCase")] on the Rust enum.
export type MergeSource = "fileA" | "fileB";

export interface CellSelection {
  keyValues: string[];
  column: string;
  source: MergeSource;
}

export type Row = string[];
