import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  bg:          "#0f172a",
  header:      "#1e293b",
  border:      "#1e293b",
  divider:     "#334155",
  text:        "#e2e8f0",
  muted:       "#64748b",
  addedText:   "#4ade80",
  deletedText: "#f87171",
  modText:     "#fb923c",
  unchText:    "#64748b",
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
  const [showUnchanged,    setShowUnchanged]    = useState(true);
  const [highlightChanged, setHighlightChanged] = useState(true);
  const [currentChangePos, setCurrentChangePos] = useState(-1);

  // Refs for each row, keyed by unified-row index (not visible-row index).
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // ── build unified row list ──────────────────────────────────────────────
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

    for (let i = 0; i < rowsA.length; i++) {
      if (deletedSet.has(i)) {
        rows.push({ rowNumber: i + 1, type: "deleted",   rowA: rowsA[i], rowB: null,                        changedColumns: new Set() });
      } else if (modifiedByA.has(i)) {
        const mod = modifiedByA.get(i)!;
        rows.push({ rowNumber: i + 1, type: "modified",  rowA: rowsA[i], rowB: rowsB[mod.rowIndexB] ?? null, changedColumns: mod.changedColumns });
      } else {
        rows.push({ rowNumber: i + 1, type: "unchanged", rowA: rowsA[i], rowB: rowsA[i],                    changedColumns: new Set() });
      }
    }

    for (const idx of result.addedRows) {
      rows.push({ rowNumber: idx + 1, type: "added", rowA: null, rowB: rowsB[idx] ?? null, changedColumns: new Set() });
    }

    return rows;
  }, [result, rowsA, rowsB]);

  // ── change index — positions in unifiedRows that are non-unchanged ──────
  const changeIndex = useMemo(
    () =>
      unifiedRows
        .map((row, i) => ({ row, i }))
        .filter(({ row }) => row.type !== "unchanged")
        .map(({ i }) => i),
    [unifiedRows]
  );

  // ── reset navigation when a new diff result arrives ─────────────────────
  useEffect(() => {
    setCurrentChangePos(-1);
    rowRefs.current = [];
  }, [result]);

  // ── summary counts ──────────────────────────────────────────────────────
  const counts = useMemo(() => {
    let added = 0, deleted = 0, modified = 0, unchanged = 0;
    for (const r of unifiedRows) {
      if      (r.type === "added")     added++;
      else if (r.type === "deleted")   deleted++;
      else if (r.type === "modified")  modified++;
      else                             unchanged++;
    }
    return { added, deleted, modified, unchanged };
  }, [unifiedRows]);

  // ── visible rows — carry the unified index so refs align ────────────────
  const visibleRows = useMemo(
    () =>
      (showUnchanged ? unifiedRows : unifiedRows.filter((r) => r.type !== "unchanged"))
        .map((row) => ({ row, unifiedIndex: unifiedRows.indexOf(row) })),
    // unifiedRows.indexOf is O(n) per call but only runs when deps change,
    // not during render. For >1k rows this could be replaced with a Map.
    [unifiedRows, showUnchanged]
  );

  // ── navigation ──────────────────────────────────────────────────────────
  const navigateNext = useCallback(() => {
    if (changeIndex.length === 0) return;
    const next = (currentChangePos + 1) % changeIndex.length;
    setCurrentChangePos(next);
    rowRefs.current[changeIndex[next]]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [changeIndex, currentChangePos]);

  const navigatePrev = useCallback(() => {
    if (changeIndex.length === 0) return;
    const prev = currentChangePos <= 0
      ? changeIndex.length - 1
      : currentChangePos - 1;
    setCurrentChangePos(prev);
    rowRefs.current[changeIndex[prev]]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [changeIndex, currentChangePos]);

  // ── keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.key === "F7" && !e.shiftKey) || (e.altKey && e.key === "ArrowDown")) {
        e.preventDefault();
        navigateNext();
      } else if ((e.key === "F7" && e.shiftKey) || (e.altKey && e.key === "ArrowUp")) {
        e.preventDefault();
        navigatePrev();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigateNext, navigatePrev]);

  const colsA = schemaA.columns;
  const colsB = schemaB.columns;

  // ── cell helpers ────────────────────────────────────────────────────────
  function cellVal(row: string[] | null, colIndex: number): string {
    if (row === null) return "—";
    return row[colIndex] ?? "";
  }

  function cellStyle(row: UnifiedRow, colName: string, side: "A" | "B"): React.CSSProperties {
    if (!highlightChanged || row.type !== "modified" || !row.changedColumns.has(colName)) return {};
    return { background: side === "A" ? CELL_A_CHANGED : CELL_B_CHANGED };
  }

  // ── shared styles ───────────────────────────────────────────────────────
  const thStyle: React.CSSProperties = {
    padding: "6px 10px", textAlign: "left", fontSize: "12px", fontWeight: 600,
    color: C.text, background: C.header,
    borderBottom: `1px solid ${C.divider}`, borderRight: `1px solid ${C.border}`,
    whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 2,
  };
  const tdStyle: React.CSSProperties = {
    padding: "5px 10px", fontSize: "13px", fontFamily: "monospace", color: C.text,
    borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`,
    whiteSpace: "nowrap", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis",
  };
  const dividerThStyle: React.CSSProperties = {
    ...thStyle, width: 2, minWidth: 2, padding: 0,
    background: C.divider, borderRight: "none", borderLeft: "none", zIndex: 3,
  };
  const dividerTdStyle: React.CSSProperties = {
    ...tdStyle, width: 2, minWidth: 2, padding: 0,
    background: C.divider, borderRight: "none", borderLeft: "none",
  };
  const rowNumThStyle: React.CSSProperties = {
    ...thStyle, width: 48, minWidth: 48, textAlign: "center",
    color: C.muted, zIndex: 3, left: 0, position: "sticky",
  };
  const rowNumTdStyle: React.CSSProperties = {
    ...tdStyle, textAlign: "center", color: C.muted,
    fontSize: "11px", fontFamily: "monospace", position: "sticky", left: 0, zIndex: 1,
  };

  const navBtnStyle: React.CSSProperties = {
    width: 28, height: 28, padding: 0,
    background: "transparent", color: C.text,
    border: `1px solid ${C.divider}`, borderRadius: "4px",
    cursor: "pointer", fontSize: "14px", lineHeight: "1",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.1s",
  };

  return (
    <div style={{ marginBottom: "24px" }}>

      {/* ── summary + controls bar ──────────────────────────────────────── */}
      <div
        style={{
          display: "flex", gap: "20px", alignItems: "center",
          padding: "10px 14px",
          background: C.header, borderRadius: "8px 8px 0 0",
          borderBottom: `1px solid ${C.divider}`,
          fontSize: "13px", flexWrap: "wrap",
        }}
      >
        {/* counts */}
        <span style={{ color: C.addedText,   fontWeight: 600 }}>+{counts.added} added</span>
        <span style={{ color: C.deletedText, fontWeight: 600 }}>−{counts.deleted} deleted</span>
        <span style={{ color: C.modText,     fontWeight: 600 }}>~{counts.modified} modified</span>
        <span style={{ color: C.unchText }}>{counts.unchanged} unchanged</span>

        {/* controls + navigation */}
        <div style={{ marginLeft: "auto", display: "flex", gap: "16px", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", color: C.muted, fontSize: "12px", cursor: "pointer" }}>
            <input type="checkbox" checked={showUnchanged}    onChange={(e) => setShowUnchanged(e.target.checked)}    style={{ cursor: "pointer" }} />
            Show unchanged
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", color: C.muted, fontSize: "12px", cursor: "pointer" }}>
            <input type="checkbox" checked={highlightChanged} onChange={(e) => setHighlightChanged(e.target.checked)} style={{ cursor: "pointer" }} />
            Highlight cells
          </label>

          {/* navigation widget */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "4px 10px",
              background: C.bg, border: `1px solid ${C.divider}`, borderRadius: "6px",
            }}
          >
            <button
              onClick={navigatePrev}
              disabled={changeIndex.length === 0}
              title="Previous change (Shift+F7 / Alt+↑)"
              aria-label="Previous change"
              style={{ ...navBtnStyle, opacity: changeIndex.length === 0 ? 0.3 : 1 }}
              onMouseEnter={(e) => { (e.currentTarget.style.background = C.divider); }}
              onMouseLeave={(e) => { (e.currentTarget.style.background = "transparent"); }}
            >
              ↑
            </button>

            <span
              style={{
                color: "#94a3b8", fontSize: "13px",
                minWidth: "120px", textAlign: "center",
                userSelect: "none",
              }}
            >
              {currentChangePos === -1
                ? `${changeIndex.length} change${changeIndex.length !== 1 ? "s" : ""}`
                : `Change ${currentChangePos + 1} of ${changeIndex.length}`}
            </span>

            <button
              onClick={navigateNext}
              disabled={changeIndex.length === 0}
              title="Next change (F7 / Alt+↓)"
              aria-label="Next change"
              style={{ ...navBtnStyle, opacity: changeIndex.length === 0 ? 0.3 : 1 }}
              onMouseEnter={(e) => { (e.currentTarget.style.background = C.divider); }}
              onMouseLeave={(e) => { (e.currentTarget.style.background = "transparent"); }}
            >
              ↓
            </button>
          </div>
        </div>
      </div>

      {/* ── table ───────────────────────────────────────────────────────── */}
      <div
        style={{
          overflowX: "auto", overflowY: "visible",
          background: C.bg,
          border: `1px solid ${C.divider}`, borderTop: "none",
          borderRadius: "0 0 8px 8px",
          willChange: "transform",
        }}
      >
        <table
          style={{
            borderCollapse: "collapse", width: "max-content",
            minWidth: "100%", tableLayout: "fixed",
          }}
        >
          <thead>
            <tr>
              <th rowSpan={2} style={{ ...rowNumThStyle, verticalAlign: "middle" }}>#</th>
              <th colSpan={colsA.length} style={{ ...thStyle, textAlign: "center", color: C.addedText,   background: "#0f1f14", borderBottom: `1px solid ${C.divider}`, zIndex: 2 }}>
                FILE A — {baseName(fileNameA)}
              </th>
              <th rowSpan={2} style={dividerThStyle} />
              <th colSpan={colsB.length} style={{ ...thStyle, textAlign: "center", color: C.deletedText, background: "#1f0f0f", borderBottom: `1px solid ${C.divider}`, zIndex: 2 }}>
                FILE B — {baseName(fileNameB)}
              </th>
            </tr>
            <tr>
              {colsA.map((col) => <th key={`ha-${col.name}`} style={thStyle}>{col.name}</th>)}
              {colsB.map((col) => <th key={`hb-${col.name}`} style={thStyle}>{col.name}</th>)}
            </tr>
          </thead>

          <tbody>
            {visibleRows.map(({ row, unifiedIndex }, i) => {
              const bg             = ROW_BG[row.type];
              const opacity        = row.type === "unchanged" ? 0.45 : 1;
              const isCurrentChange =
                currentChangePos !== -1 &&
                changeIndex[currentChangePos] === unifiedIndex;

              return (
                <tr
                  key={i}
                  ref={(el) => { rowRefs.current[unifiedIndex] = el; }}
                  style={{
                    background: bg,
                    opacity,
                    outline:       isCurrentChange ? "2px solid rgba(255,255,255,0.55)" : undefined,
                    outlineOffset: isCurrentChange ? "-2px" : undefined,
                  }}
                >
                  <td style={{ ...rowNumTdStyle, background: row.type === "unchanged" ? C.bg : bg }}>
                    {row.rowNumber}
                  </td>

                  {colsA.map((col) => (
                    <td
                      key={`a-${col.name}-${i}`}
                      style={{ ...tdStyle, ...cellStyle(row, col.name, "A"), color: row.rowA === null ? C.muted : C.text }}
                      title={cellVal(row.rowA, col.index)}
                    >
                      {cellVal(row.rowA, col.index)}
                    </td>
                  ))}

                  <td style={dividerTdStyle} />

                  {colsB.map((col) => (
                    <td
                      key={`b-${col.name}-${i}`}
                      style={{ ...tdStyle, ...cellStyle(row, col.name, "B"), color: row.rowB === null ? C.muted : C.text }}
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
                <td colSpan={colsA.length + colsB.length + 2} style={{ ...tdStyle, textAlign: "center", color: C.muted, padding: "32px" }}>
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
