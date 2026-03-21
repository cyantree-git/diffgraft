use crate::{AppError, ColumnInfo, CsvSchema};

/// Reads a CSV file from `path` and returns its schema and all data rows.
///
/// The first row is treated as a header. An empty file returns an empty schema
/// and no rows. The caller is responsible for opening the file path — this
/// function is the only place in diffgraft-core that touches the filesystem,
/// and it will be replaced by a content-based variant when the WASM target is
/// added.
///
/// # Errors
/// - [`AppError::Io`] if the file cannot be opened or read.
/// - [`AppError::Csv`] if the CSV is malformed.
pub fn read_csv(path: &str) -> Result<(CsvSchema, Vec<Vec<String>>), AppError> {
    let mut reader = csv::Reader::from_path(path)?;

    let headers = reader.headers()?.clone();
    if headers.is_empty() {
        return Ok((
            CsvSchema {
                columns: Vec::new(),
                row_count: 0,
            },
            Vec::new(),
        ));
    }

    let columns: Vec<ColumnInfo> = headers
        .iter()
        .enumerate()
        .map(|(index, name)| ColumnInfo {
            name: name.to_string(),
            index,
        })
        .collect();

    let mut rows: Vec<Vec<String>> = Vec::new();
    for result in reader.records() {
        let record = result?;
        let row: Vec<String> = record.iter().map(|f| f.to_string()).collect();
        rows.push(row);
    }

    let row_count = rows.len();
    let schema = CsvSchema { columns, row_count };

    Ok((schema, rows))
}

/// Parses CSV content from an in-memory string and returns its schema and rows.
///
/// This variant does not touch the filesystem and is safe for WASM targets.
///
/// # Errors
/// - [`AppError::Csv`] if the CSV is malformed.
pub fn parse_csv_content(content: &str) -> Result<(CsvSchema, Vec<Vec<String>>), AppError> {
    let mut reader = csv::Reader::from_reader(content.as_bytes());

    let headers = reader.headers()?.clone();
    if headers.is_empty() {
        return Ok((
            CsvSchema {
                columns: Vec::new(),
                row_count: 0,
            },
            Vec::new(),
        ));
    }

    let columns: Vec<ColumnInfo> = headers
        .iter()
        .enumerate()
        .map(|(index, name)| ColumnInfo {
            name: name.to_string(),
            index,
        })
        .collect();

    let mut rows: Vec<Vec<String>> = Vec::new();
    for result in reader.records() {
        let record = result?;
        let row: Vec<String> = record.iter().map(|f| f.to_string()).collect();
        rows.push(row);
    }

    let row_count = rows.len();
    let schema = CsvSchema { columns, row_count };

    Ok((schema, rows))
}

/// Returns column names that are likely to be primary keys, sorted by
/// confidence (most likely first).
///
/// Rules (case-insensitive):
/// 1. Column name is exactly: `id`, `key`, `code`, `uuid`, `ref`
/// 2. Column name ends with: `_id`, `_key`, `_code`, `_uuid`, `_ref`
pub fn detect_primary_key_candidates(schema: &CsvSchema) -> Vec<String> {
    const EXACT: &[&str] = &["id", "key", "code", "uuid", "ref"];
    const SUFFIXES: &[&str] = &["_id", "_key", "_code", "_uuid", "_ref"];

    let mut exact_matches: Vec<String> = Vec::new();
    let mut suffix_matches: Vec<String> = Vec::new();

    for col in &schema.columns {
        let lower = col.name.to_lowercase();
        if EXACT.contains(&lower.as_str()) {
            exact_matches.push(col.name.clone());
        } else if SUFFIXES.iter().any(|s| lower.ends_with(s)) {
            suffix_matches.push(col.name.clone());
        }
    }

    exact_matches.extend(suffix_matches);
    exact_matches
}

/// Returns column names that are likely to be noise and should be excluded
/// from diffs (timestamps, audit fields, checksums, etc.).
///
/// Matches are case-insensitive substrings of the column name.
pub fn detect_noise_columns(schema: &CsvSchema) -> Vec<String> {
    const NOISE_SUBSTRINGS: &[&str] = &[
        "created_at",
        "updated_at",
        "modified_at",
        "created_date",
        "updated_date",
        "last_modified",
        "insert_date",
        "load_date",
        "etl_timestamp",
        "row_hash",
        "checksum",
        "modified_by",
    ];

    schema
        .columns
        .iter()
        .filter(|col| {
            let lower = col.name.to_lowercase();
            NOISE_SUBSTRINGS.iter().any(|noise| lower.contains(noise))
        })
        .map(|col| col.name.clone())
        .collect()
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // --- read_csv ---

    #[test]
    fn test_read_csv_five_rows() {
        let dir = std::env::temp_dir();
        let path = dir.join("diffgraft_test_five_rows.csv");
        std::fs::write(
            &path,
            "id,name,value\n1,alice,10\n2,bob,20\n3,charlie,30\n4,diana,40\n5,eve,50\n",
        )
        .unwrap();

        let (schema, rows) = read_csv(path.to_str().unwrap()).unwrap();

        assert_eq!(schema.columns.len(), 3);
        assert_eq!(schema.columns[0].name, "id");
        assert_eq!(schema.columns[1].name, "name");
        assert_eq!(schema.columns[2].name, "value");
        assert_eq!(schema.row_count, 5);
        assert_eq!(rows.len(), 5);
        assert_eq!(rows[0], vec!["1", "alice", "10"]);
        assert_eq!(rows[4], vec!["5", "eve", "50"]);
    }

    #[test]
    fn test_read_csv_missing_file() {
        // csv::Reader::from_path wraps the IO error in csv::Error, so we get AppError::Csv.
        let result = read_csv("/tmp/diffgraft_nonexistent_file_xyz.csv");
        assert!(matches!(result, Err(AppError::Csv(_))));
    }

    // --- parse_csv_content ---

    #[test]
    fn test_parse_csv_content_basic() {
        let csv = "id,name,score\n1,alice,95\n2,bob,87\n3,charlie,72\n";
        let (schema, rows) = parse_csv_content(csv).unwrap();

        assert_eq!(schema.columns.len(), 3);
        assert_eq!(schema.columns[0].name, "id");
        assert_eq!(schema.columns[0].index, 0);
        assert_eq!(schema.columns[2].name, "score");
        assert_eq!(schema.columns[2].index, 2);
        assert_eq!(schema.row_count, 3);
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[1], vec!["2", "bob", "87"]);
    }

    #[test]
    fn test_parse_csv_content_empty_string() {
        let (schema, rows) = parse_csv_content("").unwrap();
        assert!(schema.columns.is_empty());
        assert_eq!(schema.row_count, 0);
        assert!(rows.is_empty());
    }

    #[test]
    fn test_parse_csv_content_header_only() {
        let csv = "id,name,email\n";
        let (schema, rows) = parse_csv_content(csv).unwrap();

        assert_eq!(schema.columns.len(), 3);
        assert_eq!(schema.row_count, 0);
        assert!(rows.is_empty());
    }

    #[test]
    fn test_parse_csv_content_missing_values() {
        let csv = "id,name,email\n1,,alice@example.com\n2,bob,\n";
        let (schema, rows) = parse_csv_content(csv).unwrap();

        assert_eq!(schema.row_count, 2);
        assert_eq!(rows[0][1], "");   // name is empty
        assert_eq!(rows[1][2], "");   // email is empty
        assert_eq!(rows[0][2], "alice@example.com");
        assert_eq!(rows[1][0], "2");
    }

    // --- detect_primary_key_candidates ---

    #[test]
    fn test_detect_pk_suffix_id() {
        let schema = schema_from_names(&["user_id", "name", "email"]);
        let candidates = detect_primary_key_candidates(&schema);
        assert!(candidates.contains(&"user_id".to_string()));
        assert!(!candidates.contains(&"name".to_string()));
        assert!(!candidates.contains(&"email".to_string()));
    }

    #[test]
    fn test_detect_pk_exact_id() {
        let schema = schema_from_names(&["id", "title", "body"]);
        let candidates = detect_primary_key_candidates(&schema);
        assert_eq!(candidates[0], "id");
    }

    #[test]
    fn test_detect_pk_case_insensitive() {
        let schema = schema_from_names(&["User_ID", "ORDER_KEY", "Description"]);
        let candidates = detect_primary_key_candidates(&schema);
        assert!(candidates.contains(&"User_ID".to_string()));
        assert!(candidates.contains(&"ORDER_KEY".to_string()));
        assert!(!candidates.contains(&"Description".to_string()));
    }

    #[test]
    fn test_detect_pk_all_suffixes() {
        let schema = schema_from_names(&["item_key", "product_code", "session_uuid", "parent_ref"]);
        let candidates = detect_primary_key_candidates(&schema);
        assert_eq!(candidates.len(), 4);
    }

    #[test]
    fn test_detect_pk_exact_matches_before_suffixes() {
        let schema = schema_from_names(&["user_id", "id", "ref"]);
        let candidates = detect_primary_key_candidates(&schema);
        // exact matches (id, ref) come before suffix matches (user_id)
        let id_pos = candidates.iter().position(|c| c == "id").unwrap();
        let user_id_pos = candidates.iter().position(|c| c == "user_id").unwrap();
        assert!(id_pos < user_id_pos);
    }

    #[test]
    fn test_detect_pk_no_candidates() {
        let schema = schema_from_names(&["name", "email", "status"]);
        let candidates = detect_primary_key_candidates(&schema);
        assert!(candidates.is_empty());
    }

    // --- detect_noise_columns ---

    #[test]
    fn test_detect_noise_created_at() {
        let schema = schema_from_names(&["id", "name", "created_at", "email"]);
        let noise = detect_noise_columns(&schema);
        assert!(noise.contains(&"created_at".to_string()));
        assert!(!noise.contains(&"email".to_string()));
        assert!(!noise.contains(&"id".to_string()));
    }

    #[test]
    fn test_detect_noise_all_patterns() {
        let schema = schema_from_names(&[
            "created_at",
            "updated_at",
            "modified_at",
            "created_date",
            "updated_date",
            "last_modified",
            "insert_date",
            "load_date",
            "etl_timestamp",
            "row_hash",
            "checksum",
            "modified_by",
        ]);
        let noise = detect_noise_columns(&schema);
        assert_eq!(noise.len(), 12);
    }

    #[test]
    fn test_detect_noise_case_insensitive() {
        let schema = schema_from_names(&["CREATED_AT", "UpdatedAt", "ROW_HASH"]);
        let noise = detect_noise_columns(&schema);
        assert!(noise.contains(&"CREATED_AT".to_string()));
        assert!(noise.contains(&"ROW_HASH".to_string()));
        // "UpdatedAt" contains "updatedat" which does not contain "updated_at" (underscore matters)
        assert!(!noise.contains(&"UpdatedAt".to_string()));
    }

    #[test]
    fn test_detect_noise_no_false_positives() {
        let schema = schema_from_names(&["id", "name", "email", "status", "amount"]);
        let noise = detect_noise_columns(&schema);
        assert!(noise.is_empty());
    }

    // --- helpers ---

    fn schema_from_names(names: &[&str]) -> CsvSchema {
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
}
