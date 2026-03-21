import { useState } from "react";
import type { DiffResult, ModifiedRow } from "../types/diffgraft";

interface Props {
  result: DiffResult;
}

function ExpandedChanges({ row }: { row: ModifiedRow }) {
  return (
    <div style={{ fontSize: "12px", paddingLeft: "12px", marginTop: "4px" }}>
      {row.changes.map((change) => (
        <div key={change.column} style={{ marginBottom: "2px" }}>
          <span style={{ fontWeight: 600 }}>{change.column}</span>:{" "}
          <span style={{ color: "#dc2626", textDecoration: "line-through" }}>
            {change.value_a}
          </span>{" "}
          <span style={{ color: "#16a34a" }}>{change.value_b}</span>
        </div>
      ))}
    </div>
  );
}

export function DiffTable({ result }: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showUnchanged, setShowUnchanged] = useState(false);

  const unchanged =
    Math.min(result.total_rows_a, result.total_rows_b) -
    result.modified_rows.length -
    result.deleted_rows.filter((i) => i < result.total_rows_b).length;

  function toggleExpand(idx: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <div
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "16px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span style={{ color: "#16a34a", fontWeight: 600 }}>
          +{result.added_rows.length} added
        </span>
        <span style={{ color: "#dc2626", fontWeight: 600 }}>
          -{result.deleted_rows.length} deleted
        </span>
        <span style={{ color: "#d97706", fontWeight: 600 }}>
          ~{result.modified_rows.length} modified
        </span>
        <span style={{ color: "#6b7280" }}>{unchanged} unchanged</span>

        <label
          style={{
            marginLeft: "auto",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={showUnchanged}
            onChange={(e) => setShowUnchanged(e.target.checked)}
          />
          Show unchanged rows
        </label>
      </div>

      <div style={{ fontFamily: "monospace", fontSize: "13px" }}>
        {result.deleted_rows.map((idx) => (
          <div
            key={`del-${idx}`}
            style={{
              background: "#fef2f2",
              borderLeft: "3px solid #dc2626",
              padding: "4px 8px",
              marginBottom: "2px",
            }}
          >
            - row {idx + 1} (deleted)
          </div>
        ))}

        {result.added_rows.map((idx) => (
          <div
            key={`add-${idx}`}
            style={{
              background: "#f0fdf4",
              borderLeft: "3px solid #16a34a",
              padding: "4px 8px",
              marginBottom: "2px",
            }}
          >
            + row {idx + 1} (added)
          </div>
        ))}

        {result.modified_rows.map((row, i) => (
          <div
            key={`mod-${i}`}
            style={{
              background: "#fffbeb",
              borderLeft: "3px solid #d97706",
              padding: "4px 8px",
              marginBottom: "2px",
              cursor: "pointer",
            }}
            onClick={() => toggleExpand(i)}
          >
            <div>
              ~ row {row.row_index_a + 1} ({row.changes.length} change
              {row.changes.length !== 1 ? "s" : ""})
              <span style={{ color: "#9ca3af", marginLeft: "8px", fontSize: "11px" }}>
                {expandedRows.has(i) ? "collapse" : "expand"}
              </span>
            </div>
            {expandedRows.has(i) && <ExpandedChanges row={row} />}
          </div>
        ))}

        {showUnchanged && unchanged > 0 && (
          <div style={{ color: "#9ca3af", padding: "4px 8px" }}>
            {unchanged} unchanged row{unchanged !== 1 ? "s" : ""} hidden
          </div>
        )}
      </div>
    </div>
  );
}
