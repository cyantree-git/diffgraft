#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use diffgraft_core::{
    diff::diff_csv,
    reader::{detect_noise_columns, detect_primary_key_candidates, read_csv},
    CsvSchema, DiffConfig, DiffResult,
};

/// Read a CSV file at `path` and return its schema and data rows.
#[tauri::command]
fn cmd_read_csv(path: String) -> Result<(CsvSchema, Vec<Vec<String>>), String> {
    read_csv(&path).map_err(String::from)
}

/// Return column names that are likely primary key candidates.
#[tauri::command]
fn cmd_detect_primary_key_candidates(schema: CsvSchema) -> Result<Vec<String>, String> {
    Ok(detect_primary_key_candidates(&schema))
}

/// Return column names that are likely noise and should be excluded from diffs.
#[tauri::command]
fn cmd_detect_noise_columns(schema: CsvSchema) -> Result<Vec<String>, String> {
    Ok(detect_noise_columns(&schema))
}

/// Diff two CSV datasets and return a structured result.
#[tauri::command]
fn cmd_diff_csv(
    rows_a: Vec<Vec<String>>,
    rows_b: Vec<Vec<String>>,
    schema_a: CsvSchema,
    schema_b: CsvSchema,
    config: DiffConfig,
) -> Result<DiffResult, String> {
    diff_csv(&rows_a, &rows_b, &schema_a, &schema_b, &config).map_err(String::from)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            cmd_read_csv,
            cmd_detect_primary_key_candidates,
            cmd_detect_noise_columns,
            cmd_diff_csv,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
