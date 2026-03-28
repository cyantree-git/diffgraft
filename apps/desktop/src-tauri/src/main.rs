#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use diffgraft_core::{
    diff, export,
    merge::{self, CellSelection},
    CsvReadResult, CsvSchema, DiffConfig, DiffResult, DiffSummary, MergeConfig, MergeResult,
};

/// Open a CSV file and return schema, rows, and auto-detected hints.
///
/// Runs on the blocking thread pool — safe for large files.
#[tauri::command]
async fn cmd_read_csv(path: String) -> Result<CsvReadResult, String> {
    tokio::task::spawn_blocking(move || {
        diffgraft_core::read_csv_with_hints(&path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Diff two CSV datasets and return a structured result.
///
/// Runs on the blocking thread pool — safe for large files.
#[tauri::command]
async fn cmd_diff_csv(
    rows_a: Vec<Vec<String>>,
    rows_b: Vec<Vec<String>>,
    schema_a: CsvSchema,
    schema_b: CsvSchema,
    config: DiffConfig,
) -> Result<DiffResult, String> {
    tokio::task::spawn_blocking(move || {
        diff::diff_csv(&rows_a, &rows_b, &schema_a, &schema_b, &config)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Derive a compact summary from a diff result.
///
/// Pure computation — runs inline on the async executor.
#[tauri::command]
async fn cmd_get_summary(result: DiffResult) -> Result<DiffSummary, String> {
    Ok(export::export_summary(&result))
}

/// Serialise a diff result to pretty-printed JSON.
///
/// Lightweight — runs inline on the async executor.
#[tauri::command]
async fn cmd_export_diff_json(result: DiffResult) -> Result<String, String> {
    export::export_diff_json(&result).map_err(|e| e.to_string())
}

/// Perform a cherry-pick merge of two CSV datasets.
///
/// Runs on the blocking thread pool — safe for large files.
#[tauri::command]
async fn cmd_cherry_pick_merge(
    rows_a: Vec<Vec<String>>,
    rows_b: Vec<Vec<String>>,
    schema_a: CsvSchema,
    config: MergeConfig,
    selections: Vec<CellSelection>,
) -> Result<MergeResult, String> {
    tokio::task::spawn_blocking(move || {
        merge::cherry_pick_merge(&rows_a, &rows_b, &schema_a, &config, &selections)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Serialise rows to CSV.
///
/// When `output_path` is `Some`, writes to disk and returns the path.
/// When `None`, returns the CSV string for an in-browser download.
/// Runs on the blocking thread pool.
#[tauri::command]
async fn cmd_export_csv(
    rows: Vec<Vec<String>>,
    schema: CsvSchema,
    output_path: Option<String>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        export::export_csv(&rows, &schema, output_path.as_deref()).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Open a native file-picker dialog filtered to .csv files.
///
/// Returns the selected path, or `None` if the user cancelled.
#[tauri::command]
async fn cmd_open_file_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    tokio::task::spawn_blocking(move || {
        let file = app
            .dialog()
            .file()
            .add_filter("CSV Files", &["csv"])
            .blocking_pick_file();

        Ok(file.map(|f| f.to_string()))
    })
    .await
    .map_err(|e: tokio::task::JoinError| e.to_string())?
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            cmd_read_csv,
            cmd_diff_csv,
            cmd_get_summary,
            cmd_export_diff_json,
            cmd_cherry_pick_merge,
            cmd_export_csv,
            cmd_open_file_dialog,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
