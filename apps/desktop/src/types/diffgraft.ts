export interface ColumnInfo {
  name: string;
  index: number;
}

export interface CsvSchema {
  columns: ColumnInfo[];
  row_count: number;
}

export interface DiffConfig {
  primary_keys: string[];
  ignore_columns: string[];
  case_sensitive: boolean;
}

export interface SchemaDiff {
  added_columns: ColumnInfo[];
  removed_columns: ColumnInfo[];
  common_columns: ColumnInfo[];
}

export interface CellChange {
  column: string;
  value_a: string;
  value_b: string;
}

export interface ModifiedRow {
  key_values: string[];
  row_index_a: number;
  row_index_b: number;
  changes: CellChange[];
}

export interface DiffResult {
  schema_diff: SchemaDiff;
  added_rows: number[];
  deleted_rows: number[];
  modified_rows: ModifiedRow[];
  total_rows_a: number;
  total_rows_b: number;
  auto_ignored_columns: string[];
}

export interface MergeConfig {
  primary_keys: string[];
  output_path: string | null;
}

export interface MergeResult {
  total_rows: number;
  rows_from_a: number;
  rows_from_b: number;
  output_csv: string;
}

export type Row = string[];
