import { invoke } from "@tauri-apps/api/core";
import type {
  CellSelection,
  CsvReadResult,
  CsvSchema,
  DiffConfig,
  DiffResult,
  DiffSummary,
  MergeConfig,
  MergeResult,
} from "../types/diffgraft";

/**
 * Open a CSV file and return its schema, rows, and auto-detected hints.
 * Corresponds to cmd_read_csv.
 */
export async function readCsv(path: string): Promise<CsvReadResult> {
  return invoke<CsvReadResult>("cmd_read_csv", { path });
}

/**
 * Diff two CSV datasets.
 * Corresponds to cmd_diff_csv.
 */
export async function diffCsv(
  rowsA: string[][],
  rowsB: string[][],
  schemaA: CsvSchema,
  schemaB: CsvSchema,
  config: DiffConfig
): Promise<DiffResult> {
  return invoke<DiffResult>("cmd_diff_csv", {
    rowsA,
    rowsB,
    schemaA,
    schemaB,
    config,
  });
}

/**
 * Derive a compact summary from a diff result.
 * Corresponds to cmd_get_summary.
 */
export async function getSummary(result: DiffResult): Promise<DiffSummary> {
  return invoke<DiffSummary>("cmd_get_summary", { result });
}

/**
 * Serialise a diff result to pretty-printed JSON.
 * Corresponds to cmd_export_diff_json.
 */
export async function exportDiffJson(result: DiffResult): Promise<string> {
  return invoke<string>("cmd_export_diff_json", { result });
}

/**
 * Perform a cherry-pick merge.
 * Corresponds to cmd_cherry_pick_merge.
 */
export async function cherryPickMerge(
  rowsA: string[][],
  rowsB: string[][],
  schemaA: CsvSchema,
  config: MergeConfig,
  selections: CellSelection[]
): Promise<MergeResult> {
  return invoke<MergeResult>("cmd_cherry_pick_merge", {
    rowsA,
    rowsB,
    schemaA,
    config,
    selections,
  });
}

/**
 * Serialise rows to CSV.
 * If outputPath is provided the file is written to disk and the path is
 * returned. Otherwise the CSV string is returned for a browser-style download.
 * Corresponds to cmd_export_csv.
 */
export async function exportCsv(
  rows: string[][],
  schema: CsvSchema,
  outputPath?: string
): Promise<string> {
  return invoke<string>("cmd_export_csv", {
    rows,
    schema,
    outputPath: outputPath ?? null,
  });
}

/**
 * Open a native file-picker filtered to .csv files.
 * Returns the selected path, or null if the user cancelled.
 * Corresponds to cmd_open_file_dialog.
 */
export async function openFileDialog(): Promise<string | null> {
  return invoke<string | null>("cmd_open_file_dialog");
}
