use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::{AppError, CsvSchema, MergeConfig, MergeResult};

/// Identifies which source file a merged cell value should come from.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MergeSource {
    /// Take the value from file A.
    FileA,
    /// Take the value from file B.
    FileB,
}

/// A single cell-level selection made during a cherry-pick merge.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CellSelection {
    /// Primary key values that uniquely identify the target row.
    pub key_values: Vec<String>,
    /// The column in which to apply the selection.
    pub column: String,
    /// Which file's value to use.
    pub source: MergeSource,
}

/// Performs a cherry-pick merge of two CSV datasets.
///
/// File A is used as the base. For each [`CellSelection`] with
/// [`MergeSource::FileB`] the corresponding cell in the output row is replaced
/// with the value from file B. Rows present in B but absent from A are
/// appended to the output. Rows present in A but absent from B are kept as-is.
///
/// # Errors
/// - [`AppError::Parse`] if `config.primary_keys` is empty.
/// - [`AppError::MissingColumn`] if a selection references a column that does
///   not exist in `schema_a`.
pub fn cherry_pick_merge(
    rows_a: &[Vec<String>],
    rows_b: &[Vec<String>],
    schema_a: &CsvSchema,
    config: &MergeConfig,
    selections: &[CellSelection],
) -> Result<MergeResult, AppError> {
    if config.primary_keys.is_empty() {
        return Err(AppError::Parse(
            "primary key required for merge".to_string(),
        ));
    }

    // Validate all FileB selection columns up-front so we fail before
    // mutating anything.
    for sel in selections {
        if matches!(sel.source, MergeSource::FileB) {
            schema_a
                .columns
                .iter()
                .find(|c| c.name.eq_ignore_ascii_case(&sel.column))
                .ok_or_else(|| AppError::MissingColumn(sel.column.clone()))?;
        }
    }

    // Resolve primary-key column indices once.
    let key_indices = resolve_key_indices(schema_a, &config.primary_keys)?;

    // Pre-build a key → row-index map for B to avoid O(n) scans per selection.
    let index_b = build_key_map(rows_b, &key_indices);
    // Same for A, used when appending new-B rows.
    let index_a = build_key_map(rows_a, &key_indices);

    // Start with a mutable copy of rows_a as the output base.
    let mut output: Vec<Vec<String>> = rows_a.to_vec();

    // Apply FileB selections.
    for sel in selections {
        if !matches!(sel.source, MergeSource::FileB) {
            continue; // FileA is already the base — no-op
        }

        // Locate the row in the output (mirrored from rows_a).
        let row_idx_a =
            match find_row_by_key(rows_a, schema_a, &config.primary_keys, &sel.key_values) {
                Some(i) => i,
                None => continue, // key not in A → skip gracefully
            };

        // Locate the corresponding row in B.
        let row_idx_b = match index_b.get(&sel.key_values) {
            Some(&i) => i,
            None => continue, // key not in B → skip gracefully
        };

        // Resolve the column index in schema_a (already validated above).
        let col_idx = schema_a
            .columns
            .iter()
            .find(|c| c.name.eq_ignore_ascii_case(&sel.column))
            .map(|c| c.index)
            .ok_or_else(|| AppError::MissingColumn(sel.column.clone()))?;

        // Replace the cell in the output row with the B value.
        if let Some(val_b) = rows_b[row_idx_b].get(col_idx) {
            if col_idx < output[row_idx_a].len() {
                output[row_idx_a][col_idx] = val_b.clone();
            }
        }
    }

    // Append rows from B that have no matching row in A.
    let mut rows_from_b: usize = 0;
    for row_b in rows_b {
        let key: Vec<String> = key_indices
            .iter()
            .map(|&ci| row_b.get(ci).cloned().unwrap_or_default())
            .collect();
        if !index_a.contains_key(&key) {
            output.push(row_b.clone());
            rows_from_b += 1;
        }
    }

    let rows_from_a = rows_a.len();
    let total_rows = output.len();
    let output_csv = rows_to_csv(schema_a, &output)?;

    Ok(MergeResult {
        total_rows,
        rows_from_a,
        rows_from_b,
        output_csv,
    })
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/// Returns the zero-based column index for each key column name in `schema`.
///
/// # Errors
/// - [`AppError::MissingColumn`] if any key column is absent from the schema.
fn resolve_key_indices(
    schema: &CsvSchema,
    key_columns: &[String],
) -> Result<Vec<usize>, AppError> {
    key_columns
        .iter()
        .map(|kc| {
            schema
                .columns
                .iter()
                .find(|c| c.name.eq_ignore_ascii_case(kc))
                .map(|c| c.index)
                .ok_or_else(|| AppError::MissingColumn(kc.clone()))
        })
        .collect()
}

/// Builds a `HashMap` from primary-key tuple to row index.
///
/// Duplicate keys are silently ignored (last writer wins). For merge purposes
/// the caller is responsible for ensuring uniqueness upstream.
fn build_key_map(rows: &[Vec<String>], key_indices: &[usize]) -> HashMap<Vec<String>, usize> {
    let mut map = HashMap::with_capacity(rows.len());
    for (i, row) in rows.iter().enumerate() {
        let key: Vec<String> = key_indices
            .iter()
            .map(|&ci| row.get(ci).cloned().unwrap_or_default())
            .collect();
        map.insert(key, i);
    }
    map
}

/// Returns the index of the first row in `rows` whose primary key columns
/// match `key_values`, or `None` if no row matches.
fn find_row_by_key(
    rows: &[Vec<String>],
    schema: &CsvSchema,
    key_columns: &[String],
    key_values: &[String],
) -> Option<usize> {
    // Resolve column indices; if any key column is missing return None.
    let key_indices: Vec<usize> = key_columns
        .iter()
        .filter_map(|kc| {
            schema
                .columns
                .iter()
                .find(|c| c.name.eq_ignore_ascii_case(kc))
                .map(|c| c.index)
        })
        .collect();

    if key_indices.len() != key_columns.len() {
        return None;
    }

    rows.iter().position(|row| {
        key_indices.iter().enumerate().all(|(ki, &ci)| {
            row.get(ci).map(|v| v.as_str()) == key_values.get(ki).map(|v| v.as_str())
        })
    })
}

/// Serialises `rows` with the header from `schema` into a CSV string.
///
/// # Errors
/// - [`AppError::Export`] if the csv writer or UTF-8 conversion fails.
fn rows_to_csv(schema: &CsvSchema, rows: &[Vec<String>]) -> Result<String, AppError> {
    let mut writer = csv::WriterBuilder::new()
        .has_headers(false)
        .from_writer(Vec::new());

    // Write header row.
    let header: Vec<&str> = schema.columns.iter().map(|c| c.name.as_str()).collect();
    writer
        .write_record(&header)
        .map_err(|e| AppError::Export(e.to_string()))?;

    // Write data rows.
    for row in rows {
        writer
            .write_record(row)
            .map_err(|e| AppError::Export(e.to_string()))?;
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
    use crate::{ColumnInfo, CsvSchema, MergeConfig};

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

    fn config(keys: &[&str]) -> MergeConfig {
        MergeConfig {
            primary_keys: keys.iter().map(|s| s.to_string()).collect(),
            output_path: None,
        }
    }

    fn sel_b(key_values: &[&str], column: &str) -> CellSelection {
        CellSelection {
            key_values: key_values.iter().map(|s| s.to_string()).collect(),
            column: column.to_string(),
            source: MergeSource::FileB,
        }
    }

    fn sel_a(key_values: &[&str], column: &str) -> CellSelection {
        CellSelection {
            key_values: key_values.iter().map(|s| s.to_string()).collect(),
            column: column.to_string(),
            source: MergeSource::FileA,
        }
    }

    fn rows(data: &[&[&str]]) -> Vec<Vec<String>> {
        data.iter()
            .map(|r| r.iter().map(|s| s.to_string()).collect())
            .collect()
    }

    /// Parse a CSV string back into rows (header excluded) for easy comparison.
    fn parse_output(csv: &str) -> Vec<Vec<String>> {
        let mut reader = csv::Reader::from_reader(csv.as_bytes());
        reader
            .records()
            .map(|r| r.unwrap().iter().map(|f| f.to_string()).collect())
            .collect()
    }

    // --- no primary key ---

    #[test]
    fn test_merge_no_primary_key_error() {
        let schema = make_schema(&["id", "name"]);
        let r = rows(&[&["1", "alice"]]);
        let result = cherry_pick_merge(&r, &r, &schema, &config(&[]), &[]);
        assert!(matches!(result, Err(AppError::Parse(_))));
    }

    // --- empty selections → output identical to A ---

    #[test]
    fn test_merge_empty_selections_output_equals_a() {
        let schema = make_schema(&["id", "name", "email"]);
        let ra = rows(&[
            &["1", "alice", "a@co.com"],
            &["2", "bob", "b@co.com"],
        ]);
        let rb = rows(&[
            &["1", "alice", "new_a@co.com"],
            &["2", "bob", "new_b@co.com"],
        ]);
        let result = cherry_pick_merge(&ra, &rb, &schema, &config(&["id"]), &[]).unwrap();
        let out = parse_output(&result.output_csv);
        assert_eq!(out, ra);
        assert_eq!(result.rows_from_a, 2);
        assert_eq!(result.rows_from_b, 0);
        assert_eq!(result.total_rows, 2);
    }

    // --- take all cells from B for a row → that row equals B ---

    #[test]
    fn test_merge_all_cells_from_b() {
        let schema = make_schema(&["id", "name", "email"]);
        let ra = rows(&[&["1", "alice", "old@co.com"]]);
        let rb = rows(&[&["1", "alice", "new@co.com"]]);
        let sels = vec![sel_b(&["1"], "email"), sel_b(&["1"], "name")];
        let result = cherry_pick_merge(&ra, &rb, &schema, &config(&["id"]), &sels).unwrap();
        let out = parse_output(&result.output_csv);
        assert_eq!(out[0][1], "alice");
        assert_eq!(out[0][2], "new@co.com");
    }

    // --- take all cells from A → output identical to A ---

    #[test]
    fn test_merge_all_cells_from_a() {
        let schema = make_schema(&["id", "name", "email"]);
        let ra = rows(&[&["1", "alice", "old@co.com"]]);
        let rb = rows(&[&["1", "alice", "new@co.com"]]);
        let sels = vec![sel_a(&["1"], "email"), sel_a(&["1"], "name")];
        let result = cherry_pick_merge(&ra, &rb, &schema, &config(&["id"]), &sels).unwrap();
        let out = parse_output(&result.output_csv);
        assert_eq!(out, ra);
    }

    // --- cherry-pick correctness at cell level ---

    #[test]
    fn test_merge_cherry_pick_cell_level() {
        // File A: id=1, name=Alice, email=old@co.com, status=active
        // File B: id=1, name=Alice, email=new@co.com, status=inactive
        // Take email from B, keep status from A.
        // Expected: id=1, name=Alice, email=new@co.com, status=active
        let schema = make_schema(&["id", "name", "email", "status"]);
        let ra = rows(&[&["1", "Alice", "old@co.com", "active"]]);
        let rb = rows(&[&["1", "Alice", "new@co.com", "inactive"]]);
        let sels = vec![
            sel_b(&["1"], "email"),  // take email from B
            sel_a(&["1"], "status"), // keep status from A (no-op)
        ];
        let result =
            cherry_pick_merge(&ra, &rb, &schema, &config(&["id"]), &sels).unwrap();
        let out = parse_output(&result.output_csv);
        assert_eq!(out.len(), 1);
        let row = &out[0];
        assert_eq!(row[0], "1");
        assert_eq!(row[1], "Alice");
        assert_eq!(row[2], "new@co.com"); // from B
        assert_eq!(row[3], "active");    // kept from A
    }

    // --- mixed: two rows, only one cherry-picked ---

    #[test]
    fn test_merge_mixed_rows() {
        let schema = make_schema(&["id", "value"]);
        let ra = rows(&[&["1", "old1"], &["2", "old2"]]);
        let rb = rows(&[&["1", "new1"], &["2", "new2"]]);
        // Only patch row id=1.
        let sels = vec![sel_b(&["1"], "value")];
        let result = cherry_pick_merge(&ra, &rb, &schema, &config(&["id"]), &sels).unwrap();
        let out = parse_output(&result.output_csv);
        assert_eq!(out[0][1], "new1"); // patched
        assert_eq!(out[1][1], "old2"); // unchanged
    }

    // --- new row in B not in A → appears in output ---

    #[test]
    fn test_merge_new_row_from_b_appended() {
        let schema = make_schema(&["id", "name"]);
        let ra = rows(&[&["1", "alice"]]);
        let rb = rows(&[&["1", "alice"], &["2", "bob"]]);
        let result = cherry_pick_merge(&ra, &rb, &schema, &config(&["id"]), &[]).unwrap();
        let out = parse_output(&result.output_csv);
        assert_eq!(out.len(), 2);
        assert_eq!(out[1][0], "2");
        assert_eq!(out[1][1], "bob");
        assert_eq!(result.rows_from_b, 1);
        assert_eq!(result.total_rows, 2);
    }

    // --- row in A not in B → kept in output ---

    #[test]
    fn test_merge_row_only_in_a_kept() {
        let schema = make_schema(&["id", "name"]);
        let ra = rows(&[&["1", "alice"], &["2", "bob"]]);
        let rb = rows(&[&["1", "alice"]]);
        let result = cherry_pick_merge(&ra, &rb, &schema, &config(&["id"]), &[]).unwrap();
        let out = parse_output(&result.output_csv);
        assert_eq!(out.len(), 2);
        assert_eq!(out[1][0], "2"); // row 2 kept from A
        assert_eq!(result.rows_from_b, 0);
        assert_eq!(result.rows_from_a, 2);
    }

    // --- selection for non-existent key → skip gracefully ---

    #[test]
    fn test_merge_selection_nonexistent_key_skipped() {
        let schema = make_schema(&["id", "value"]);
        let ra = rows(&[&["1", "v1"]]);
        let rb = rows(&[&["1", "v1_b"]]);
        // Select from a key that doesn't exist in either file.
        let sels = vec![sel_b(&["999"], "value")];
        let result = cherry_pick_merge(&ra, &rb, &schema, &config(&["id"]), &sels).unwrap();
        let out = parse_output(&result.output_csv);
        // Output unchanged — non-existent key was silently skipped.
        assert_eq!(out[0][1], "v1");
    }

    // --- selection for non-existent column → MissingColumn error ---

    #[test]
    fn test_merge_selection_nonexistent_column_errors() {
        let schema = make_schema(&["id", "value"]);
        let ra = rows(&[&["1", "v1"]]);
        let rb = rows(&[&["1", "v1_b"]]);
        let sels = vec![sel_b(&["1"], "nonexistent_col")];
        let result = cherry_pick_merge(&ra, &rb, &schema, &config(&["id"]), &sels);
        assert!(matches!(result, Err(AppError::MissingColumn(_))));
    }

    // --- output_csv is valid parseable CSV ---

    #[test]
    fn test_merge_output_csv_has_header() {
        let schema = make_schema(&["id", "name"]);
        let ra = rows(&[&["1", "alice"]]);
        let rb = rows(&[&["1", "alice"]]);
        let result = cherry_pick_merge(&ra, &rb, &schema, &config(&["id"]), &[]).unwrap();
        // First line of output_csv must be the header.
        let first_line = result.output_csv.lines().next().unwrap();
        assert_eq!(first_line, "id,name");
    }

    // --- counts are correct when both new and existing rows are present ---

    #[test]
    fn test_merge_counts_mixed() {
        let schema = make_schema(&["id", "name"]);
        let ra = rows(&[&["1", "alice"], &["2", "bob"]]);
        let rb = rows(&[
            &["1", "alice_b"],
            &["2", "bob_b"],
            &["3", "charlie"], // new
        ]);
        let result = cherry_pick_merge(&ra, &rb, &schema, &config(&["id"]), &[]).unwrap();
        assert_eq!(result.rows_from_a, 2);
        assert_eq!(result.rows_from_b, 1);
        assert_eq!(result.total_rows, 3);
    }
}
