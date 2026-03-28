use crate::{AppError, CsvSchema, DiffResult, DiffSummary};

/// Serialises `rows` to CSV format.
///
/// - If `output_path` is `Some(path)`: writes the CSV to that file and returns
///   the path as a `String`.
/// - If `output_path` is `None`: returns the CSV content as an in-memory
///   `String` (used by the web version and for Tauri download blobs).
///
/// The first row written is always the header derived from `schema.columns`.
///
/// # Errors
/// - [`AppError::Io`] if the output file cannot be created or written.
/// - [`AppError::Csv`] if the csv writer fails to serialise a record.
/// - [`AppError::Export`] if the in-memory buffer cannot be converted to UTF-8.
pub fn export_csv(
    rows: &[Vec<String>],
    schema: &CsvSchema,
    output_path: Option<&str>,
) -> Result<String, AppError> {
    match output_path {
        None => {
            // Return CSV as an in-memory String.
            let csv = build_csv_string(schema, rows)?;
            Ok(csv)
        }
        Some(path) => {
            // Write to file; use std::fs for the file handle so that IO errors
            // surface as AppError::Io rather than being wrapped in csv::Error.
            let file = std::fs::File::create(path)?;
            let mut writer = csv::WriterBuilder::new()
                .has_headers(false)
                .from_writer(file);

            let header: Vec<&str> = schema.columns.iter().map(|c| c.name.as_str()).collect();
            writer.write_record(&header)?;

            for row in rows {
                writer.write_record(row)?;
            }

            writer.flush()?;
            Ok(path.to_string())
        }
    }
}

/// Serialises `result` to a pretty-printed JSON string.
///
/// This enables CLI, API, and browser consumers to process diff results without
/// understanding the binary format.
///
/// # Errors
/// - [`AppError::Export`] if serde_json serialisation fails.
pub fn export_diff_json(result: &DiffResult) -> Result<String, AppError> {
    serde_json::to_string_pretty(result).map_err(|e| AppError::Export(e.to_string()))
}

/// Derives a compact [`DiffSummary`] from `result`.
///
/// Pure computation — no I/O, no fallible operations.
pub fn export_summary(result: &DiffResult) -> DiffSummary {
    let added = result.added_rows.len();
    let deleted = result.deleted_rows.len();
    let modified = result.modified_rows.len();
    let unchanged = result
        .total_rows_a
        .saturating_sub(deleted)
        .saturating_sub(modified);

    let schema_changes_count =
        result.schema_diff.added_columns.len() + result.schema_diff.removed_columns.len();

    DiffSummary {
        added,
        deleted,
        modified,
        unchanged,
        total_a: result.total_rows_a,
        total_b: result.total_rows_b,
        has_schema_changes: schema_changes_count > 0,
        schema_changes_count,
    }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/// Builds a CSV string in memory from `schema` headers and `rows`.
fn build_csv_string(schema: &CsvSchema, rows: &[Vec<String>]) -> Result<String, AppError> {
    let mut writer = csv::WriterBuilder::new()
        .has_headers(false)
        .from_writer(Vec::new());

    let header: Vec<&str> = schema.columns.iter().map(|c| c.name.as_str()).collect();
    writer.write_record(&header)?;

    for row in rows {
        writer.write_record(row)?;
    }

    let bytes = writer
        .into_inner()
        .map_err(|e| AppError::Export(e.to_string()))?;

    String::from_utf8(bytes).map_err(|e| AppError::Export(e.to_string()))
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{CellChange, ColumnInfo, CsvSchema, DiffResult, ModifiedRow, SchemaDiff};

    fn make_schema(names: &[&str]) -> CsvSchema {
        CsvSchema {
            columns: names
                .iter()
                .enumerate()
                .map(|(i, n)| ColumnInfo {
                    name: n.to_string(),
                    index: i,
                })
                .collect(),
            row_count: 0,
        }
    }

    fn rows(data: &[&[&str]]) -> Vec<Vec<String>> {
        data.iter()
            .map(|r| r.iter().map(|s| s.to_string()).collect())
            .collect()
    }

    fn empty_diff_result(total_a: usize, total_b: usize) -> DiffResult {
        DiffResult {
            schema_diff: SchemaDiff {
                added_columns: vec![],
                removed_columns: vec![],
                common_columns: vec![],
            },
            added_rows: vec![],
            deleted_rows: vec![],
            modified_rows: vec![],
            total_rows_a: total_a,
            total_rows_b: total_b,
            auto_ignored_columns: vec![],
        }
    }

    // --- export_csv: in-memory (None path) ---

    #[test]
    fn test_export_csv_returns_string() {
        let schema = make_schema(&["id", "name", "value"]);
        let data = rows(&[
            &["1", "alice", "10"],
            &["2", "bob", "20"],
            &["3", "charlie", "30"],
        ]);
        let result = export_csv(&data, &schema, None).unwrap();
        // Should have 4 lines: header + 3 data rows (trailing newline from csv crate).
        let lines: Vec<&str> = result.lines().collect();
        assert_eq!(lines.len(), 4);
        assert_eq!(lines[0], "id,name,value");
        assert_eq!(lines[1], "1,alice,10");
        assert_eq!(lines[3], "3,charlie,30");
    }

    #[test]
    fn test_export_csv_header_is_first_row() {
        let schema = make_schema(&["product_id", "sku", "price"]);
        let data = rows(&[&["1", "ABC", "9.99"]]);
        let result = export_csv(&data, &schema, None).unwrap();
        let first_line = result.lines().next().unwrap();
        assert_eq!(first_line, "product_id,sku,price");
    }

    #[test]
    fn test_export_csv_empty_rows_just_header() {
        let schema = make_schema(&["id", "name"]);
        let result = export_csv(&[], &schema, None).unwrap();
        let lines: Vec<&str> = result.lines().collect();
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0], "id,name");
    }

    #[test]
    fn test_export_csv_roundtrip() {
        // Parse the exported string back and compare with original rows.
        let schema = make_schema(&["id", "name"]);
        let data = rows(&[&["1", "alice"], &["2", "bob"]]);
        let csv_str = export_csv(&data, &schema, None).unwrap();

        let mut reader = csv::Reader::from_reader(csv_str.as_bytes());
        let parsed: Vec<Vec<String>> = reader
            .records()
            .map(|r| r.unwrap().iter().map(|f| f.to_string()).collect())
            .collect();
        assert_eq!(parsed, data);
    }

    // --- export_csv: file path ---

    #[test]
    fn test_export_csv_to_file() {
        let schema = make_schema(&["id", "name"]);
        let data = rows(&[&["1", "alice"], &["2", "bob"]]);

        let path = std::env::temp_dir()
            .join("diffgraft_export_test.csv")
            .to_string_lossy()
            .into_owned();

        let returned_path = export_csv(&data, &schema, Some(&path)).unwrap();
        assert_eq!(returned_path, path);

        // File must exist and content must be correct.
        let content = std::fs::read_to_string(&path).unwrap();
        let lines: Vec<&str> = content.lines().collect();
        assert_eq!(lines[0], "id,name");
        assert_eq!(lines[1], "1,alice");
        assert_eq!(lines[2], "2,bob");
    }

    // --- export_diff_json ---

    #[test]
    fn test_export_diff_json_is_valid_json() {
        let result = empty_diff_result(5, 4);
        let json = export_diff_json(&result).unwrap();
        // Must parse without error.
        let _: serde_json::Value = serde_json::from_str(&json).unwrap();
    }

    #[test]
    fn test_export_diff_json_contains_required_keys() {
        let result = empty_diff_result(10, 8);
        let json = export_diff_json(&result).unwrap();
        assert!(json.contains("\"addedRows\""));
        assert!(json.contains("\"deletedRows\""));
        assert!(json.contains("\"modifiedRows\""));
        assert!(json.contains("\"totalRowsA\""));
        assert!(json.contains("\"totalRowsB\""));
    }

    #[test]
    fn test_export_diff_json_roundtrip() {
        let mut result = empty_diff_result(3, 3);
        result.added_rows = vec![2];
        result.deleted_rows = vec![0, 1];
        result.modified_rows = vec![ModifiedRow {
            key_values: vec!["k1".to_string()],
            row_index_a: 0,
            row_index_b: 0,
            changes: vec![CellChange {
                column: "col".to_string(),
                value_a: "old".to_string(),
                value_b: "new".to_string(),
            }],
        }];

        let json = export_diff_json(&result).unwrap();
        let restored: DiffResult = serde_json::from_str(&json).unwrap();

        assert_eq!(restored.added_rows, result.added_rows);
        assert_eq!(restored.deleted_rows, result.deleted_rows);
        assert_eq!(restored.modified_rows.len(), 1);
        assert_eq!(restored.modified_rows[0].changes[0].value_b, "new");
    }

    // --- export_summary ---

    #[test]
    fn test_export_summary_counts() {
        let mut result = empty_diff_result(15, 12);
        result.added_rows = vec![0, 1, 2]; // 3 added
        result.deleted_rows = vec![3, 4]; // 2 deleted
                                          // 5 modified rows
        result.modified_rows = (0..5)
            .map(|i| ModifiedRow {
                key_values: vec![i.to_string()],
                row_index_a: i,
                row_index_b: i,
                changes: vec![],
            })
            .collect();

        let summary = export_summary(&result);

        assert_eq!(summary.added, 3);
        assert_eq!(summary.deleted, 2);
        assert_eq!(summary.modified, 5);
        // unchanged = 15 - 2 - 5 = 8
        assert_eq!(summary.unchanged, 8);
        assert_eq!(summary.total_a, 15);
        assert_eq!(summary.total_b, 12);
    }

    #[test]
    fn test_export_summary_schema_changes() {
        let mut result = empty_diff_result(3, 3);
        result.schema_diff.added_columns = vec![ColumnInfo {
            name: "new_col".to_string(),
            index: 3,
        }];
        result.schema_diff.removed_columns = vec![ColumnInfo {
            name: "old_col".to_string(),
            index: 2,
        }];

        let summary = export_summary(&result);

        assert!(summary.has_schema_changes);
        assert_eq!(summary.schema_changes_count, 2); // 1 added + 1 removed
    }

    #[test]
    fn test_export_summary_no_schema_changes() {
        let result = empty_diff_result(5, 5);
        let summary = export_summary(&result);
        assert!(!summary.has_schema_changes);
        assert_eq!(summary.schema_changes_count, 0);
    }

    #[test]
    fn test_export_summary_unchanged_calculation() {
        // unchanged = total_a - deleted - modified
        let mut result = empty_diff_result(10, 10);
        result.deleted_rows = vec![0, 1, 2]; // 3 deleted
        result.modified_rows = (0..4)
            .map(|i| ModifiedRow {
                key_values: vec![i.to_string()],
                row_index_a: i,
                row_index_b: i,
                changes: vec![],
            })
            .collect(); // 4 modified

        let summary = export_summary(&result);
        // unchanged = 10 - 3 - 4 = 3
        assert_eq!(summary.unchanged, 3);
    }
}
