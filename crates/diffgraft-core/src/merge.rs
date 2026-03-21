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
/// For each row identified by its primary key, individual cell values are taken
/// from the source specified in `selections`. Rows that have no selection
/// default to file A's values.
///
/// # Errors
/// Returns [`AppError`] variants as the implementation is completed.
pub fn cherry_pick_merge(
    _rows_a: &[Vec<String>],
    _rows_b: &[Vec<String>],
    _schema_a: &CsvSchema,
    _config: &MergeConfig,
    _selections: &[CellSelection],
) -> Result<MergeResult, AppError> {
    todo!("cherry_pick_merge is not yet implemented")
}
