import { useMemo, useState } from "react";
import type { DiffResult, CsvSchema } from "../types/diffgraft";

interface Props {
  result: DiffResult;
  schemaA: CsvSchema;
  schemaB: CsvSchema;
  rowsA: string[][];
  rowsB: string[][];
  fileNameA: string;
  fileNameB: string;
}

type RowType = "unchanged" | "modified" | "added" | "deleted";

interface UnifiedRow {
  rowNumber: number;
  type: RowType;
  rowA: string[] | null;
  rowB: string[] | null;
  changedColumns: Set<string>;
}

// ─── colours ────────────────────────────────────────────────────────────────

const ROW_BG: Record<RowType, string> = {
  unchanged: "transparent",
  modified:  "rgba(146,  64,  14, 0.30)",
  added:     "rgba( 20,  83,  45, 0.40)",
  deleted:   "rgba(127,  29,  29, 0.40)",
};

const CELL_A_CHANGED = "rgba(239, 68,  68, 0.45)";
const CELL_B_CHANGED = "rgba( 34, 197, 94, 0.40)";

const C = {
  bg:         "#0f172a",
  header:     "#1e293b",
  border:     "#1e293b",
  divider:    "#334155",
  text:       "#e2e8f0",
  muted:      "#64748b",
  addedText:  "#4ade80",
  deletedText:"#f87171",
  modText:    "#fb923c",
  unchText:   "#64748b",
} as const;

// ─── helpers ────────────────────────────────────────────────────────────────

function baseName(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() ?? path;
}

// ─── component ──────────────────────────────────────────────────────────────

export function SideBySideDiffTable({
  result,
  schemaA,
  schemaB,
  rowsA,
  rowsB,
  fileNameA,
  fileNameB,
}: Props) {
  const [showUnchanged,     setShowUnchanged]     = useState(true);
  const [highlightChanged,  setHighlightChanged]  = useState(true);

  // ── build unified row list (memoised) ──────────────────────────────────
  const unifiedRows = useMemo<UnifiedRow[]>(() => {
    const deletedSet = new Set(result.deletedRows);

    const modifiedByA = new Map<
      number,
      { rowIndexB: number; changedColumns: Set<string> }
    >();
    for (const mr of result.modifiedRows) {
      modifiedByA.set(mr.rowIndexA, {
        rowIndexB:      mr.rowIndexB,
        changedColumns: new Set(mr.changes.map((c) => c.column)),
      });
    }

    const rows: UnifiedRow[] = [];

    // Rows sourced from A
    for (let i = 0; i < rowsA.length; i++) {
      if (deletedSet.has(i)) {
        rows.push({
          rowNumber:      i + 1,
          type:           "deleted",
          rowA:           rowsA[i],
          rowB:           null,
          changedColumns: new Set(),
        });
      } else if (modifiedByA.has(i)) {
        const mod = modifiedByA.get(i)!;
        rows.push({
          rowNumber:      i + 1,
          type:           "modified",
          rowA:           rowsA[i],
          rowB:           rowsB[mod.rowIndexB] ?? null,
          changedColumns: mod.changedColumns,
        });
      } else {
        // Unchanged — both sides are identical; display A values for both.
        rows.push({
          rowNumber:      i + 1,
          type:           "unchanged",
          rowA:           rowsA[i],
          rowB:           rowsA[i],
          changedColumns: new Set(),
        });
      }
    }

    // Rows only in B (added)
    for (const idx of result.addedRows) {
      rows.push({
        rowNumber:      idx + 1,
        type:           "added",
        rowA:           null,
        rowB:           rowsB[idx] ?? null,
        changedColumns: new Set(),
      });
    }

    return rows;
  }, [result, rowsA, rowsB]);

  // ── summary counts ─────────────────────────────────────────────────────
  const counts = useMemo(() => {
    let added = 0, deleted = 0, modified = 0, unchanged = 0;
    for (const r of unifiedRows) {
      if (r.type === "added")     added++;
      else if (r.type === "deleted")  deleted++;
      else if (r.type === "modified") modified++;
      else                         unchanged++;
    }
    return { added, deleted, modified, unchanged };
  }, [unifiedRows]);

  // ── filter rows ────────────────────────────────────────────────────────
  const visibleRows = useMemo(
    () =>
      showUnchanged
        ? unifiedRows
        : unifiedRows.filter((r) => r.type !== "unchanged"),
    [unifiedRows, showUnchanged]
  );

  const colsA = schemaA.columns;
  const colsB = schemaB.columns;

  // ── cell value helper ──────────────────────────────────────────────────
  function cellVal(row: string[] | null, colIndex: number): string {
    if (row === null) return "—";
    return row[colIndex] ?? "";
  }

  function cellStyle(
    row: UnifiedRow,
    colName: string,
    side: "A" | "B"
  ): React.CSSProperties {
    if (!highlightChanged) return {};
    if (row.type !== "modified") return {};
    if (!row.changedColumns.has(colName)) return {};
    return { background: side === "A" ? CELL_A_CHANGED : CELL_B_CHANGED };
  }

  // ── shared styles ──────────────────────────────────────────────────────
  const thStyle: React.CSSProperties = {
    padding: "6px 10px",
    textAlign: "left",
    fontSize: "12px",
    fontWeight: 600,
    color: C.text,
    background: C.header,
    borderBottom: `1px solid ${C.divider}`,
    borderRight: `1px solid ${C.border}`,
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
    zIndex: 2,
  };

  const tdStyle: React.CSSProperties = {
    padding: "5px 10px",
    fontSize: "13px",
    fontFamily: "monospace",
    color: C.text,
    borderBottom: `1px solid ${C.border}`,
    borderRight: `1px solid ${C.border}`,
    whiteSpace: "nowrap",
    maxWidth: "220px",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const dividerThStyle: React.CSSProperties = {
    ...thStyle,
    width: 2,
    minWidth: 2,
    padding: 0,
    background: C.divider,
    borderRight: "none",
    borderLeft: "none",
    zIndex: 3,
  };

  const dividerTdStyle: React.CSSProperties = {
    ...tdStyle,
    width: 2,
    minWidth: 2,
    padding: 0,
    background: C.divider,
    borderRight: "none",
    borderLeft: "none",
  };

  const rowNumThStyle: React.CSSProperties = {
    ...thStyle,
    width: 48,
    minWidth: 48,
    textAlign: "center",
    color: C.muted,
    zIndex: 3,
    left: 0,
    position: "sticky",
  };

  const rowNumTdStyle: React.CSSProperties = {
    ...tdStyle,
    textAlign: "center",
    color: C.muted,
    fontSize: "11px",
    fontFamily: "monospace",
    position: "sticky",
    left: 0,
    zIndex: 1,
  };

  return (
    <div style={{ marginBottom: "24px" }}>

      {/* ── summary bar ─────────────────────────────────────────────── */}
      <div
        style={{
          display:        "flex",
          gap:            "20px",
          alignItems:     "center",
          padding:        "10px 14px",
          background:     C.header,
          borderRadius:   "8px 8px 0 0",
          borderBottom:   `1px solid ${C.divider}`,
          fontSize:       "13px",
          flexWrap:       "wrap",
        }}
      >
        <span style={{ color: C.addedText,   fontWeight: 600 }}>+{counts.added} added</span>
        <span style={{ color: C.deletedText, fontWeight: 600 }}>−{counts.deleted} deleted</span>
        <span style={{ color: C.modText,     fontWeight: 600 }}>~{counts.modified} modified</span>
        <span style={{ color: C.unchText }}>{counts.unchanged} unchanged</span>

        <div style={{ marginLeft: "auto", display: "flex", gap: "16px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", color: C.muted, fontSize: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showUnchanged}
              onChange={(e) => setShowUnchanged(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            Show unchanged rows
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", color: C.muted, fontSize: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={highlightChanged}
              onChange={(e) => setHighlightChanged(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            Highlight changed cells
          </label>
        </div>
      </div>

      {/* ── table ───────────────────────────────────────────────────── */}
      <div
        style={{
          overflowX:    "auto",
          overflowY:    "visible",
          background:   C.bg,
          border:       `1px solid ${C.divider}`,
          borderTop:    "none",
          borderRadius: "0 0 8px 8px",
          willChange:   "transform",
        }}
      >
        <table
          style={{
            borderCollapse: "collapse",
            width:          "max-content",
            minWidth:       "100%",
            tableLayout:    "fixed",
          }}
        >
          <thead>
            {/* ── file header row ──────────────────────────────────── */}
            <tr>
              <th rowSpan={2} style={{ ...rowNumThStyle, verticalAlign: "middle" }}>
                #
              </th>

              {/* File A heading */}
              <th
                colSpan={colsA.length}
                style={{
                  ...thStyle,
                  textAlign:    "center",
                  color:        C.addedText,
                  background:   "#0f1f14",
                  borderBottom: `1px solid ${C.divider}`,
                  zIndex:       2,
                }}
              >
                FILE A — {baseName(fileNameA)}
              </th>

              {/* divider */}
              <th rowSpan={2} style={dividerThStyle} />

              {/* File B heading */}
              <th
                colSpan={colsB.length}
                style={{
                  ...thStyle,
                  textAlign:    "center",
                  color:        C.deletedText,
                  background:   "#1f0f0f",
                  borderBottom: `1px solid ${C.divider}`,
                  zIndex:       2,
                }}
              >
                FILE B — {baseName(fileNameB)}
              </th>
            </tr>

            {/* ── column name row ───────────────────────────────────── */}
            <tr>
              {colsA.map((col) => (
                <th key={`ha-${col.name}`} style={thStyle}>
                  {col.name}
                </th>
              ))}
              {colsB.map((col) => (
                <th key={`hb-${col.name}`} style={thStyle}>
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {visibleRows.map((row, i) => {
              const bg      = ROW_BG[row.type];
              const opacity = row.type === "unchanged" ? 0.45 : 1;

              return (
                <tr
                  key={i}
                  style={{ background: bg, opacity }}
                >
                  {/* row number */}
                  <td style={{ ...rowNumTdStyle, background: row.type === "unchanged" ? C.bg : bg }}>
                    {row.rowNumber}
                  </td>

                  {/* File A cells */}
                  {colsA.map((col) => (
                    <td
                      key={`a-${col.name}-${i}`}
                      style={{
                        ...tdStyle,
                        ...cellStyle(row, col.name, "A"),
                        color: row.rowA === null ? C.muted : C.text,
                      }}
                      title={cellVal(row.rowA, col.index)}
                    >
                      {cellVal(row.rowA, col.index)}
                    </td>
                  ))}

                  {/* divider */}
                  <td style={dividerTdStyle} />

                  {/* File B cells */}
                  {colsB.map((col) => (
                    <td
                      key={`b-${col.name}-${i}`}
                      style={{
                        ...tdStyle,
                        ...cellStyle(row, col.name, "B"),
                        color: row.rowB === null ? C.muted : C.text,
                      }}
                      title={cellVal(row.rowB, col.index)}
                    >
                      {cellVal(row.rowB, col.index)}
                    </td>
                  ))}
                </tr>
              );
            })}

            {visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={colsA.length + colsB.length + 2}
                  style={{ ...tdStyle, textAlign: "center", color: C.muted, padding: "32px" }}
                >
                  No rows to display.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
