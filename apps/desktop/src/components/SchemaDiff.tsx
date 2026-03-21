import type { SchemaDiff as SchemaDiffType } from "../types/diffgraft";

interface Props {
  schemaDiff: SchemaDiffType;
}

export function SchemaDiff({ schemaDiff }: Props) {
  const { added_columns, removed_columns, common_columns } = schemaDiff;
  const hasChanges = added_columns.length > 0 || removed_columns.length > 0;

  if (!hasChanges && common_columns.length === 0) return null;

  return (
    <div
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "16px",
      }}
    >
      <h3 style={{ margin: "0 0 12px" }}>Schema Diff</h3>

      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
        {added_columns.length > 0 && (
          <div>
            <div style={{ fontWeight: 500, color: "#16a34a", marginBottom: "4px" }}>
              + Added ({added_columns.length})
            </div>
            {added_columns.map((col) => (
              <div
                key={col.name}
                style={{
                  fontSize: "13px",
                  color: "#16a34a",
                  background: "#f0fdf4",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  marginBottom: "2px",
                }}
              >
                {col.name}
              </div>
            ))}
          </div>
        )}

        {removed_columns.length > 0 && (
          <div>
            <div style={{ fontWeight: 500, color: "#dc2626", marginBottom: "4px" }}>
              - Removed ({removed_columns.length})
            </div>
            {removed_columns.map((col) => (
              <div
                key={col.name}
                style={{
                  fontSize: "13px",
                  color: "#dc2626",
                  background: "#fef2f2",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  marginBottom: "2px",
                }}
              >
                {col.name}
              </div>
            ))}
          </div>
        )}

        <div>
          <div style={{ fontWeight: 500, color: "#6b7280", marginBottom: "4px" }}>
            Common ({common_columns.length})
          </div>
          <div style={{ fontSize: "13px", color: "#9ca3af" }}>
            {common_columns.length} shared column{common_columns.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
