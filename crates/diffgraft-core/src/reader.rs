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
