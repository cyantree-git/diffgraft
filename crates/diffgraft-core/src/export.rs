use crate::{AppError, CsvSchema};

/// Serialises `rows` back to CSV format.
///
/// - If `output_path` is `Some`, the CSV is written to that path and the path
///   is returned as the result string.
/// - If `output_path` is `None`, the CSV is returned as an in-memory `String`.
///
/// # Errors
/// - [`AppError::Io`] if the output file cannot be written.
/// - [`AppError::Export`] if serialisation fails.
pub fn export_csv(
    _rows: &[Vec<String>],
    _schema: &CsvSchema,
    _output_path: Option<&str>,
) -> Result<String, AppError> {
    todo!("export_csv is not yet implemented")
}
