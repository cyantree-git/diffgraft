import type { DiffResult } from "../types/diffgraft";

export type RowType = "unchanged" | "modified" | "added" | "deleted";

export interface UnifiedRow {
  rowNumber: number;
  type: RowType;
  rowA: string[] | null;
  rowB: string[] | null;
  changedColumns: Set<string>;
}

export function buildUnifiedRows(
  result: DiffResult,
  rowsA: string[][],
  rowsB: string[][],
): UnifiedRow[] {
  const deletedSet = new Set(result.deletedRows);
  const modifiedByA = new Map<number, { rowIndexB: number; changedColumns: Set<string> }>();

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
}
