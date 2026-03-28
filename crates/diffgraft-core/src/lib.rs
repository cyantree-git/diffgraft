pub mod diff;
pub mod error;
pub mod export;
pub mod merge;
pub mod reader;

pub use error::AppError;

use serde::{Deserialize, Serialize};

// Serialisation note:
// All public structs use #[serde(rename_all = "camelCase")]
// to ensure clean interop with TypeScript across the Tauri
// IPC boundary. Rust field names remain snake_case internally.
// JSON produced by Tauri uses camelCase matching TypeScript
// conventions. This is a project-wide convention — all new
// structs crossing the IPC boundary must follow it.

/// The result of opening a CSV file, bundling schema, rows, and auto-detected
/// hints in one struct so the frontend needs only a single round-trip.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvReadResult {
    /// The inferred schema (columns + row count).
    pub schema: CsvSchema,
    /// All data rows as raw strings.
    pub rows: Vec<Vec<String>>,
    /// Columns detected as likely primary key candidates.
    pub primary_key_candidates: Vec<String>,
    /// Columns detected as likely noise (timestamps, audit fields, etc.).
    pub noise_columns: Vec<String>,
}

/// Opens a CSV file and returns schema, rows, and auto-detected hints in a
/// single call.
///
/// Combines [`reader::read_csv`], [`reader::detect_primary_key_candidates`],
/// and [`reader::detect_noise_columns`] so callers avoid three separate
/// invocations.
///
/// # Errors
/// - [`AppError::Io`] / [`AppError::Csv`] if the file cannot be read.
pub fn read_csv_with_hints(path: &str) -> Result<CsvReadResult, AppError> {
    let (schema, rows) = reader::read_csv(path)?;
    let primary_key_candidates = reader::detect_primary_key_candidates(&schema);
    let noise_columns = reader::detect_noise_columns(&schema);
    Ok(CsvReadResult {
        schema,
        rows,
        primary_key_candidates,
        noise_columns,
    })
}

/// Describes a single column in a CSV schema.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    /// Column header name.
    pub name: String,
    /// Zero-based position of the column in the file.
    pub index: usize,
}

/// The inferred schema of a CSV file.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvSchema {
    /// Ordered list of columns.
    pub columns: Vec<ColumnInfo>,
    /// Number of data rows (excluding the header).
    pub row_count: usize,
}

/// Configuration that drives a diff operation.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffConfig {
    /// Columns whose combined values uniquely identify a row.
    /// An empty vec means diff is performed by row order.
    pub primary_keys: Vec<String>,
    /// Columns to exclude from the diff entirely.
    pub ignore_columns: Vec<String>,
    /// When false, cell values are compared case-insensitively.
    pub case_sensitive: bool,
}

/// The result of comparing two CSV schemas.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaDiff {
    /// Columns present in B but not in A.
    pub added_columns: Vec<ColumnInfo>,
    /// Columns present in A but not in B.
    pub removed_columns: Vec<ColumnInfo>,
    /// Columns present in both A and B (using A's index).
    pub common_columns: Vec<ColumnInfo>,
}

/// A single cell-level change within a modified row.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CellChange {
    /// The column in which the change occurred.
    pub column: String,
    /// The value in file A.
    pub value_a: String,
    /// The value in file B.
    pub value_b: String,
}

/// A row that exists in both files but has at least one differing cell.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModifiedRow {
    /// The primary key values that identify this row.
    pub key_values: Vec<String>,
    /// Row index in file A (zero-based, data rows only).
    pub row_index_a: usize,
    /// Row index in file B (zero-based, data rows only).
    pub row_index_b: usize,
    /// The individual cell changes.
    pub changes: Vec<CellChange>,
}

/// The full result of a CSV diff operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffResult {
    /// Schema-level differences between the two files.
    pub schema_diff: SchemaDiff,
    /// Row indices in file B that have no matching row in file A.
    pub added_rows: Vec<usize>,
    /// Row indices in file A that have no matching row in file B.
    pub deleted_rows: Vec<usize>,
    /// Rows that exist in both files but differ in at least one cell.
    pub modified_rows: Vec<ModifiedRow>,
    /// Total data rows in file A.
    pub total_rows_a: usize,
    /// Total data rows in file B.
    pub total_rows_b: usize,
    /// Noise columns auto-detected from the schema (timestamps, hashes, etc.).
    pub auto_ignored_columns: Vec<String>,
}

/// Configuration for a cherry-pick merge operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeConfig {
    /// Columns used to match rows between A and B.
    pub primary_keys: Vec<String>,
    /// Optional filesystem path for the output file.
    pub output_path: Option<String>,
}

/// A compact, human-readable summary derived from a [`DiffResult`].
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffSummary {
    /// Rows present in B but not in A.
    pub added: usize,
    /// Rows present in A but not in B.
    pub deleted: usize,
    /// Rows present in both files but with at least one changed cell.
    pub modified: usize,
    /// Rows present in both files with identical values.
    pub unchanged: usize,
    /// Total data rows in file A.
    pub total_a: usize,
    /// Total data rows in file B.
    pub total_b: usize,
    /// True when any columns were added or removed between A and B.
    pub has_schema_changes: bool,
    /// Total number of added + removed columns.
    pub schema_changes_count: usize,
}

/// The result of a merge operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeResult {
    /// Total rows in the merged output.
    pub total_rows: usize,
    /// Rows whose final values came entirely from file A.
    pub rows_from_a: usize,
    /// Rows whose final values came entirely from file B.
    pub rows_from_b: usize,
    /// The complete merged CSV as a UTF-8 string.
    pub output_csv: String,
}
