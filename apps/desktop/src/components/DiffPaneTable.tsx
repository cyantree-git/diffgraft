import type { CsvSchema } from "../types/diffgraft";
import type { UnifiedRow } from "../lib/unifiedRows";

interface Props {
  side: "A" | "B";
  schema: CsvSchema;
  unifiedRows: UnifiedRow[] | null;
  rawRows: string[][];
  currentChangeIndex: number;
  changeIndex: number[];
  highlightCells: boolean;
}

function cellVal(row: string[] | null, colIndex: number): string {
  if (row === null) return "—";
  return row[colIndex] ?? "";
}

export function DiffPaneTable({
  side,
  schema,
  unifiedRows,
  rawRows,
  currentChangeIndex,
  changeIndex,
  highlightCells,
}: Props) {
  const cols = schema.columns;

  // ── plain table (no diff yet) ─────────────────────────────────────────
  if (unifiedRows === null) {
    return (
      <table>
        <thead>
          <tr>
            <th style={{ width: 48, textAlign: "right", paddingRight: 8 }}>#</th>
            {cols.map((c) => <th key={c.name}>{c.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {rawRows.map((row, i) => (
            <tr key={i}>
              <td style={{ width: 48, textAlign: "right", color: "#475569", paddingRight: 8, fontSize: 11 }}>{i + 1}</td>
              {cols.map((c) => (
                <td key={c.name} title={row[c.index] ?? ""}>{row[c.index] ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // ── diff table ────────────────────────────────────────────────────────
  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: 48, textAlign: "right", paddingRight: 8 }}>#</th>
          {cols.map((c) => <th key={c.name}>{c.name}</th>)}
        </tr>
      </thead>
      <tbody>
        {unifiedRows.map((row, i) => {
          const isCurrentChange =
            currentChangeIndex !== -1 && changeIndex[currentChangeIndex] === i;

          const dataRow = side === "A" ? row.rowA : row.rowB;

          // For added rows on side A, or deleted rows on side B → show placeholder
          const isPlaceholder =
            (side === "A" && row.type === "added") ||
            (side === "B" && row.type === "deleted");

          const trClass = [
            `row-${row.type}`,
            isCurrentChange ? "row-current-change" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <tr
              key={i}
              className={trClass}
            >
              <td style={{ width: 48, textAlign: "right", color: "#475569", paddingRight: 8, fontSize: 11 }}>
                {row.rowNumber}
              </td>
              {isPlaceholder
                ? cols.map((c) => (
                    <td key={c.name} className="placeholder-cell">—</td>
                  ))
                : cols.map((c) => {
                    const val = cellVal(dataRow, c.index);
                    const isChanged =
                      highlightCells &&
                      row.type === "modified" &&
                      row.changedColumns.has(c.name);
                    const cellClass = isChanged
                      ? (side === "A" ? "cell-changed-a" : "cell-changed-b")
                      : undefined;
                    return (
                      <td key={c.name} className={cellClass} title={val}>{val}</td>
                    );
                  })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
