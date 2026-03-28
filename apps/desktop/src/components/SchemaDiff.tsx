import type { SchemaDiff as SchemaDiffType } from "../types/diffgraft";

interface Props {
  schemaDiff: SchemaDiffType;
}

export function SchemaDiff({ schemaDiff }: Props) {
  const { addedColumns, removedColumns, commonColumns } = schemaDiff;
  const hasChanges = addedColumns.length > 0 || removedColumns.length > 0;

  if (!hasChanges && commonColumns.length === 0) return null;

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
        {addedColumns.length > 0 && (
          <div>
            <div style={{ fontWeight: 500, color: "#16a34a", marginBottom: "4px" }}>
              + Added ({addedColumns.length})
            </div>
            {addedColumns.map((col) => (
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

        {removedColumns.length > 0 && (
          <div>
            <div style={{ fontWeight: 500, color: "#dc2626", marginBottom: "4px" }}>
              - Removed ({removedColumns.length})
            </div>
            {removedColumns.map((col) => (
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
            Common ({commonColumns.length})
          </div>
          <div style={{ fontSize: "13px", color: "#9ca3af" }}>
            {commonColumns.length} shared column{commonColumns.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
