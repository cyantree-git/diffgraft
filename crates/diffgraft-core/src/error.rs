use thiserror::Error;

/// All errors that can be returned by diffgraft-core.
#[derive(Debug, Error)]
pub enum AppError {
    /// Wraps std::io::Error for file and stream operations.
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// Wraps csv::Error for malformed or unreadable CSV data.
    #[error("CSV error: {0}")]
    Csv(#[from] csv::Error),

    /// A value could not be parsed or interpreted.
    #[error("Parse error: {0}")]
    Parse(String),

    /// A required column was not found in the schema.
    #[error("Missing column: {0}")]
    MissingColumn(String),

    /// A primary key value appears more than once in the dataset.
    #[error("Duplicate key: {0}")]
    DuplicateKey(String),

    /// An error occurred during CSV export.
    #[error("Export error: {0}")]
    Export(String),
}

impl From<AppError> for String {
    fn from(e: AppError) -> String {
        e.to_string()
    }
}
