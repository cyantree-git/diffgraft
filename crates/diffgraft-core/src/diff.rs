use std::collections::HashMap;

use crate::{
    reader::detect_noise_columns, AppError, CellChange, ColumnInfo, CsvSchema, DiffConfig,
    DiffResult, ModifiedRow, SchemaDiff,
};

/// Return type shared by the two private diff strategies.
type DiffParts = Result<(Vec<usize>, Vec<usize>, Vec<ModifiedRow>), AppError>;

/// Compares the schemas of two CSV files and returns what changed.
///
/// `common_columns` uses indices from `schema_a`.
pub fn diff_schema(schema_a: &CsvSchema, schema_b: &CsvSchema) -> SchemaDiff {
    let names_a: HashMap<&str, usize> = schema_a
        .columns
        .iter()
        .map(|c| (c.name.as_str(), c.index))
        .collect();
    let names_b: HashMap<&str, usize> = schema_b
        .columns
        .iter()
        .map(|c| (c.name.as_str(), c.index))
        .collect();

    let mut added_columns: Vec<ColumnInfo> = schema_b
        .columns
        .iter()
        .filter(|c| !names_a.contains_key(c.name.as_str()))
        .cloned()
        .collect();

    let mut removed_columns: Vec<ColumnInfo> = schema_a
        .columns
        .iter()
        .filter(|c| !names_b.contains_key(c.name.as_str()))
        .cloned()
        .collect();

    let mut common_columns: Vec<ColumnInfo> = schema_a
        .columns
        .iter()
        .filter(|c| names_b.contains_key(c.name.as_str()))
        .cloned()
        .collect();

    added_columns.sort_by_key(|c| c.index);
    removed_columns.sort_by_key(|c| c.index);
    common_columns.sort_by_key(|c| c.index);

    SchemaDiff {
        added_columns,
        removed_columns,
        common_columns,
    }
}

/// Diffs two CSV datasets according to `config`.
///
/// When `config.primary_keys` is empty the diff is order-dependent (row N in A
/// vs row N in B). When primary keys are provided, rows are matched by their
/// combined key values.
///
/// # Errors
/// - [`AppError::MissingColumn`] if a key column does not exist in the schema.
/// - [`AppError::DuplicateKey`] if a primary key value appears more than once.
pub fn diff_csv(
    rows_a: &[Vec<String>],
    rows_b: &[Vec<String>],
    schema_a: &CsvSchema,
    schema_b: &CsvSchema,
    config: &DiffConfig,
) -> Result<DiffResult, AppError> {
    let schema_diff = diff_schema(schema_a, schema_b);
    let auto_ignored_columns = detect_noise_columns(schema_a);

    // Columns to compare: common to both schemas and not explicitly ignored.
    let compare_columns: Vec<&ColumnInfo> = schema_diff
        .common_columns
        .iter()
        .filter(|col| {
            !config.ignore_columns.iter().any(|ig| {
                if config.case_sensitive {
                    ig == &col.name
                } else {
                    ig.to_lowercase() == col.name.to_lowercase()
                }
            })
        })
        .collect();

    let (added_rows, deleted_rows, modified_rows) = if config.primary_keys.is_empty() {
        diff_by_order(rows_a, rows_b, &compare_columns, schema_a, schema_b, config)?
    } else {
        diff_by_key(rows_a, rows_b, &compare_columns, schema_a, schema_b, config)?
    };

    Ok(DiffResult {
        schema_diff,
        added_rows,
        deleted_rows,
        modified_rows,
        total_rows_a: rows_a.len(),
        total_rows_b: rows_b.len(),
        auto_ignored_columns,
    })
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/// Builds a map from primary-key tuple → row index for the given rows.
///
/// # Errors
/// - [`AppError::MissingColumn`] if a key column is absent from the schema.
/// - [`AppError::DuplicateKey`] if the same key tuple appears more than once.
fn build_key_index(
    rows: &[Vec<String>],
    schema: &CsvSchema,
    key_columns: &[String],
) -> Result<HashMap<Vec<String>, usize>, AppError> {
    let key_indices: Vec<usize> = key_columns
        .iter()
        .map(|kc| {
            schema
                .columns
                .iter()
                .find(|c| c.name.eq_ignore_ascii_case(kc))
                .map(|c| c.index)
                .ok_or_else(|| AppError::MissingColumn(kc.clone()))
        })
        .collect::<Result<Vec<_>, _>>()?;

    let mut index: HashMap<Vec<String>, usize> = HashMap::with_capacity(rows.len());

    for (row_idx, row) in rows.iter().enumerate() {
        let key: Vec<String> = key_indices
            .iter()
            .map(|&ci| row.get(ci).cloned().unwrap_or_default())
            .collect();

        if let Some(prev) = index.insert(key.clone(), row_idx) {
            return Err(AppError::DuplicateKey(format!(
                "{:?} appears at rows {} and {}",
                key, prev, row_idx
            )));
        }
    }

    Ok(index)
}

/// Returns the index of `col_name` within `schema`, or an error.
fn col_index_in(schema: &CsvSchema, col_name: &str) -> Result<usize, AppError> {
    schema
        .columns
        .iter()
        .find(|c| c.name == col_name)
        .map(|c| c.index)
        .ok_or_else(|| AppError::MissingColumn(col_name.to_string()))
}

/// Compares two rows cell by cell for the given columns.
fn compare_rows(
    row_a: &[String],
    row_b: &[String],
    compare_columns: &[&ColumnInfo],
    schema_b: &CsvSchema,
    case_sensitive: bool,
) -> Vec<CellChange> {
    let mut changes = Vec::new();

    for col in compare_columns {
        let val_a = row_a.get(col.index).cloned().unwrap_or_default();
        let idx_b = schema_b
            .columns
            .iter()
            .find(|c| c.name == col.name)
            .map(|c| c.index)
            .unwrap_or(col.index);
        let val_b = row_b.get(idx_b).cloned().unwrap_or_default();

        let differs = if case_sensitive {
            val_a != val_b
        } else {
            val_a.to_lowercase() != val_b.to_lowercase()
        };

        if differs {
            changes.push(CellChange {
                column: col.name.clone(),
                value_a: val_a,
                value_b: val_b,
            });
        }
    }

    changes
}

/// Order-based diff: row N in A vs row N in B.
fn diff_by_order(
    rows_a: &[Vec<String>],
    rows_b: &[Vec<String>],
    compare_columns: &[&ColumnInfo],
    schema_a: &CsvSchema,
    schema_b: &CsvSchema,
    config: &DiffConfig,
) -> DiffParts {
    let common_len = rows_a.len().min(rows_b.len());

    let mut modified_rows = Vec::new();
    for i in 0..common_len {
        let changes = compare_rows(
            &rows_a[i],
            &rows_b[i],
            compare_columns,
            schema_b,
            config.case_sensitive,
        );
        if !changes.is_empty() {
            modified_rows.push(ModifiedRow {
                key_values: vec![i.to_string()],
                row_index_a: i,
                row_index_b: i,
                changes,
            });
        }
    }

    let deleted_rows: Vec<usize> = (common_len..rows_a.len()).collect();
    let added_rows: Vec<usize> = (common_len..rows_b.len()).collect();

    let _ = schema_a; // schema_a column indices are used via compare_columns
    Ok((added_rows, deleted_rows, modified_rows))
}

/// Key-based diff: rows matched by primary key values.
fn diff_by_key(
    rows_a: &[Vec<String>],
    rows_b: &[Vec<String>],
    compare_columns: &[&ColumnInfo],
    schema_a: &CsvSchema,
    schema_b: &CsvSchema,
    config: &DiffConfig,
) -> DiffParts {
    let index_a = build_key_index(rows_a, schema_a, &config.primary_keys)?;
    let index_b = build_key_index(rows_b, schema_b, &config.primary_keys)?;

    // Key indices for extracting key_values to embed in ModifiedRow.
    let key_indices_a: Vec<usize> = config
        .primary_keys
        .iter()
        .map(|kc| col_index_in(schema_a, kc))
        .collect::<Result<Vec<_>, _>>()?;

    let mut deleted_rows = Vec::new();
    let mut modified_rows = Vec::new();

    for (key, &row_idx_a) in &index_a {
        match index_b.get(key) {
            None => deleted_rows.push(row_idx_a),
            Some(&row_idx_b) => {
                let changes = compare_rows(
                    &rows_a[row_idx_a],
                    &rows_b[row_idx_b],
                    compare_columns,
                    schema_b,
                    config.case_sensitive,
                );
                if !changes.is_empty() {
                    let key_values: Vec<String> = key_indices_a
                        .iter()
                        .map(|&ci| rows_a[row_idx_a].get(ci).cloned().unwrap_or_default())
                        .collect();
                    modified_rows.push(ModifiedRow {
                        key_values,
                        row_index_a: row_idx_a,
                        row_index_b: row_idx_b,
                        changes,
                    });
                }
            }
        }
    }

    let added_rows: Vec<usize> = index_b
        .iter()
        .filter(|(key, _)| !index_a.contains_key(*key))
        .map(|(_, &idx)| idx)
        .collect();

    deleted_rows.sort_unstable();
    modified_rows.sort_unstable_by_key(|r| r.row_index_a);
    let mut added_rows_sorted = added_rows;
    added_rows_sorted.sort_unstable();

    Ok((added_rows_sorted, deleted_rows, modified_rows))
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ColumnInfo, CsvSchema, DiffConfig};

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

    // --- diff_schema ---

    #[test]
    fn test_diff_schema_identical() {
        let s = make_schema(&["id", "name", "value"]);
        let result = diff_schema(&s, &s);
        assert!(result.added_columns.is_empty());
        assert!(result.removed_columns.is_empty());
        assert_eq!(result.common_columns.len(), 3);
    }

    #[test]
    fn test_diff_schema_added_and_removed() {
        let a = make_schema(&["id", "name"]);
        let b = make_schema(&["id", "email"]);
        let result = diff_schema(&a, &b);
        assert_eq!(result.added_columns.len(), 1);
        assert_eq!(result.added_columns[0].name, "email");
        assert_eq!(result.removed_columns.len(), 1);
        assert_eq!(result.removed_columns[0].name, "name");
        assert_eq!(result.common_columns.len(), 1);
        assert_eq!(result.common_columns[0].name, "id");
    }

    // --- diff_csv: empty inputs ---

    #[test]
    fn test_diff_csv_empty() {
        let schema = make_schema(&["id", "name"]);
        let config = DiffConfig::default();
        let result = diff_csv(&[], &[], &schema, &schema, &config).unwrap();
        assert!(result.added_rows.is_empty());
        assert!(result.deleted_rows.is_empty());
        assert!(result.modified_rows.is_empty());
    }

    // --- diff_csv: order-based ---

    #[test]
    fn test_diff_csv_order_no_changes() {
        let schema = make_schema(&["id", "name"]);
        let rows = vec![
            vec!["1".to_string(), "alice".to_string()],
            vec!["2".to_string(), "bob".to_string()],
        ];
        let config = DiffConfig::default();
        let result = diff_csv(&rows, &rows, &schema, &schema, &config).unwrap();
        assert!(result.added_rows.is_empty());
        assert!(result.deleted_rows.is_empty());
        assert!(result.modified_rows.is_empty());
    }

    #[test]
    fn test_diff_csv_order_modification() {
        let schema = make_schema(&["id", "name"]);
        let rows_a = vec![vec!["1".to_string(), "alice".to_string()]];
        let rows_b = vec![vec!["1".to_string(), "ALICE".to_string()]];
        let config = DiffConfig {
            case_sensitive: true,
            ..Default::default()
        };
        let result = diff_csv(&rows_a, &rows_b, &schema, &schema, &config).unwrap();
        assert_eq!(result.modified_rows.len(), 1);
        assert_eq!(result.modified_rows[0].changes[0].column, "name");
    }

    #[test]
    fn test_diff_csv_order_case_insensitive_no_change() {
        let schema = make_schema(&["id", "name"]);
        let rows_a = vec![vec!["1".to_string(), "alice".to_string()]];
        let rows_b = vec![vec!["1".to_string(), "ALICE".to_string()]];
        let config = DiffConfig {
            case_sensitive: false,
            ..Default::default()
        };
        let result = diff_csv(&rows_a, &rows_b, &schema, &schema, &config).unwrap();
        assert!(result.modified_rows.is_empty());
    }

    #[test]
    fn test_diff_csv_order_added_deleted() {
        let schema = make_schema(&["id"]);
        let rows_a = vec![vec!["1".to_string()], vec!["2".to_string()]];
        let rows_b = vec![
            vec!["1".to_string()],
            vec!["2".to_string()],
            vec!["3".to_string()],
        ];
        let config = DiffConfig::default();
        let result = diff_csv(&rows_a, &rows_b, &schema, &schema, &config).unwrap();
        assert_eq!(result.added_rows, vec![2]);
        assert!(result.deleted_rows.is_empty());
    }

    // --- diff_csv: key-based ---

    #[test]
    fn test_diff_csv_key_based_added_deleted() {
        let schema = make_schema(&["id", "name"]);
        let rows_a = vec![
            vec!["1".to_string(), "alice".to_string()],
            vec!["2".to_string(), "bob".to_string()],
        ];
        let rows_b = vec![
            vec!["1".to_string(), "alice".to_string()],
            vec!["3".to_string(), "charlie".to_string()],
        ];
        let config = DiffConfig {
            primary_keys: vec!["id".to_string()],
            ..Default::default()
        };
        let result = diff_csv(&rows_a, &rows_b, &schema, &schema, &config).unwrap();
        assert_eq!(result.deleted_rows, vec![1]); // row index 1 in A (id=2)
        assert_eq!(result.added_rows, vec![1]); // row index 1 in B (id=3)
        assert!(result.modified_rows.is_empty());
    }

    #[test]
    fn test_diff_csv_key_based_modification() {
        let schema = make_schema(&["id", "value"]);
        let rows_a = vec![vec!["1".to_string(), "old".to_string()]];
        let rows_b = vec![vec!["1".to_string(), "new".to_string()]];
        let config = DiffConfig {
            primary_keys: vec!["id".to_string()],
            case_sensitive: true,
            ..Default::default()
        };
        let result = diff_csv(&rows_a, &rows_b, &schema, &schema, &config).unwrap();
        assert_eq!(result.modified_rows.len(), 1);
        assert_eq!(result.modified_rows[0].key_values, vec!["1"]);
        assert_eq!(result.modified_rows[0].changes[0].value_a, "old");
        assert_eq!(result.modified_rows[0].changes[0].value_b, "new");
    }

    #[test]
    fn test_diff_csv_duplicate_key_error() {
        let schema = make_schema(&["id", "name"]);
        let rows_a = vec![
            vec!["1".to_string(), "alice".to_string()],
            vec!["1".to_string(), "bob".to_string()],
        ];
        let rows_b = vec![vec!["1".to_string(), "charlie".to_string()]];
        let config = DiffConfig {
            primary_keys: vec!["id".to_string()],
            ..Default::default()
        };
        let result = diff_csv(&rows_a, &rows_b, &schema, &schema, &config);
        assert!(matches!(result, Err(AppError::DuplicateKey(_))));
    }

    #[test]
    fn test_diff_csv_single_row() {
        let schema = make_schema(&["id"]);
        let rows_a = vec![vec!["1".to_string()]];
        let rows_b = vec![vec!["1".to_string()]];
        let config = DiffConfig::default();
        let result = diff_csv(&rows_a, &rows_b, &schema, &schema, &config).unwrap();
        assert!(result.added_rows.is_empty());
        assert!(result.deleted_rows.is_empty());
        assert!(result.modified_rows.is_empty());
    }
}
