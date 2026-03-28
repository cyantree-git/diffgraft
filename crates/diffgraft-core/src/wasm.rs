#![cfg(target_arch = "wasm32")]

use wasm_bindgen::prelude::*;
use crate::*;

/// Read a CSV file from an in-memory string.
/// Returns a JSON-serialised [`CsvReadResult`].
#[wasm_bindgen]
pub fn wasm_read_csv(content: &str) -> Result<String, JsValue> {
    let (schema, rows) = crate::reader::parse_csv_content(content)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let candidates = crate::reader::detect_primary_key_candidates(&schema);
    let noise = crate::reader::detect_noise_columns(&schema);
    let result = CsvReadResult {
        schema,
        rows,
        primary_key_candidates: candidates,
        noise_columns: noise,
    };
    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Diff two CSV files provided as in-memory strings.
/// Returns a JSON-serialised [`DiffResult`].
#[wasm_bindgen]
pub fn wasm_diff_csv(
    content_a: &str,
    content_b: &str,
    config_json: &str,
) -> Result<String, JsValue> {
    let (schema_a, rows_a) = crate::reader::parse_csv_content(content_a)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let (schema_b, rows_b) = crate::reader::parse_csv_content(content_b)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let config: DiffConfig = serde_json::from_str(config_json)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let result = crate::diff::diff_csv(&rows_a, &rows_b, &schema_a, &schema_b, &config)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Derive a compact summary from a JSON-serialised [`DiffResult`].
/// Returns a JSON-serialised [`DiffSummary`].
#[wasm_bindgen]
pub fn wasm_get_summary(result_json: &str) -> Result<String, JsValue> {
    let result: DiffResult = serde_json::from_str(result_json)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let summary = crate::export::export_summary(&result);
    serde_json::to_string(&summary)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Serialise a JSON-serialised [`DiffResult`] to a pretty-printed JSON diff report.
#[wasm_bindgen]
pub fn wasm_export_diff_json(result_json: &str) -> Result<String, JsValue> {
    let result: DiffResult = serde_json::from_str(result_json)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    crate::export::export_diff_json(&result)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Cherry-pick merge two CSV files provided as in-memory strings.
/// Returns a JSON-serialised [`MergeResult`].
#[wasm_bindgen]
pub fn wasm_cherry_pick_merge(
    content_a: &str,
    content_b: &str,
    config_json: &str,
    selections_json: &str,
) -> Result<String, JsValue> {
    let (schema_a, rows_a) = crate::reader::parse_csv_content(content_a)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let (_, rows_b) = crate::reader::parse_csv_content(content_b)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let config: MergeConfig = serde_json::from_str(config_json)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let selections: Vec<crate::merge::CellSelection> = serde_json::from_str(selections_json)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let result = crate::merge::cherry_pick_merge(&rows_a, &rows_b, &schema_a, &config, &selections)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}
