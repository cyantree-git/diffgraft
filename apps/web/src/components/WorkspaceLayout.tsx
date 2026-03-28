import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CsvReadResult, DiffResult, DiffSummary } from "../types/diffgraft";
import { buildUnifiedRows } from "../lib/unifiedRows";
import { HeaderBar } from "./HeaderBar";
import { FilePane } from "./FilePane";
import { FloatingNav } from "./FloatingNav";
import { DetailsPopup } from "./DetailsPopup";

interface Props {
  fileA: CsvReadResult | null;
  fileB: CsvReadResult | null;
  fileAName: string | null;
  fileBName: string | null;
  primaryKeys: string[];
  ignoreColumns: string[];
  diffResult: DiffResult | null;
  diffSummary: DiffSummary | null;
  isLoading: boolean;
  error: string | null;
  showDetailsA: boolean;
  showDetailsB: boolean;
  onFileALoaded: (result: CsvReadResult, content: string, name: string) => void;
  onFileBLoaded: (result: CsvReadResult, content: string, name: string) => void;
  onPrimaryKeysChange: (keys: string[]) => void;
  onIgnoreColumnsChange: (cols: string[]) => void;
  onRerunDiff: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onShowDetailsA: () => void;
  onShowDetailsB: () => void;
  onHideDetailsA: () => void;
  onHideDetailsB: () => void;
}

export function WorkspaceLayout({
  fileA, fileB, fileAName, fileBName,
  primaryKeys, ignoreColumns,
  diffResult, diffSummary,
  isLoading, error,
  showDetailsA, showDetailsB,
  onFileALoaded, onFileBLoaded,
  onPrimaryKeysChange, onIgnoreColumnsChange,
  onRerunDiff, onExportJson, onExportCsv,
  onShowDetailsA, onShowDetailsB,
  onHideDetailsA, onHideDetailsB,
}: Props) {

  // ── unified rows + change index ────────────────────────────────────────
  const unifiedRows = useMemo(() => {
    if (!diffResult || !fileA || !fileB) return null;
    return buildUnifiedRows(diffResult, fileA.rows, fileB.rows);
  }, [diffResult, fileA, fileB]);

  const changeIndex = useMemo(
    () =>
      unifiedRows
        ? unifiedRows
            .map((row, i) => ({ row, i }))
            .filter(({ row }) => row.type !== "unchanged")
            .map(({ i }) => i)
        : [],
    [unifiedRows]
  );

  // ── navigation state ───────────────────────────────────────────────────
  const [currentChangeIndex, setCurrentChangeIndex] = useState(-1);

  useEffect(() => {
    setCurrentChangeIndex(-1);
  }, [diffResult]);

  // ── scroll refs ────────────────────────────────────────────────────────
  const scrollRefA = useRef<HTMLDivElement>(null);
  const scrollRefB = useRef<HTMLDivElement>(null);
  const isSyncing  = useRef(false);

  useEffect(() => {
    const a = scrollRefA.current;
    const b = scrollRefB.current;
    if (!a || !b) return;

    function syncFromA() {
      if (isSyncing.current) return;
      isSyncing.current = true;
      b!.scrollTop  = a!.scrollTop;
      b!.scrollLeft = a!.scrollLeft;
      setTimeout(() => { isSyncing.current = false; }, 50);
    }

    function syncFromB() {
      if (isSyncing.current) return;
      isSyncing.current = true;
      a!.scrollTop  = b!.scrollTop;
      a!.scrollLeft = b!.scrollLeft;
      setTimeout(() => { isSyncing.current = false; }, 50);
    }

    a.addEventListener("scroll", syncFromA, { passive: true });
    b.addEventListener("scroll", syncFromB, { passive: true });
    return () => {
      a.removeEventListener("scroll", syncFromA);
      b.removeEventListener("scroll", syncFromB);
    };
  }, [fileA, fileB, diffResult]);

  // ── first-row ref (for measuring actual row height) ───────────────────
  const firstRowRef = useRef<HTMLTableRowElement | null>(null);

  function getRowHeight(): number {
    return firstRowRef.current?.getBoundingClientRect().height ?? 37;
  }

  // ── navigation ─────────────────────────────────────────────────────────
  function scrollToRow(rowIndex: number) {
    const rowHeight = getRowHeight();
    const containerHeight = scrollRefA.current?.clientHeight ?? 0;
    const targetScrollTop = Math.max(
      0,
      rowIndex * rowHeight - containerHeight / 2 + rowHeight / 2,
    );

    console.log("navigating to", {
      rowIndex,
      rowHeight,
      containerHeight,
      targetScrollTop,
    });

    isSyncing.current = true;
    if (scrollRefA.current) scrollRefA.current.scrollTop = targetScrollTop;
    if (scrollRefB.current) scrollRefB.current.scrollTop = targetScrollTop;
    setTimeout(() => { isSyncing.current = false; }, 50);
  }

  const navigateNext = useCallback(() => {
    if (changeIndex.length === 0) return;
    const next = (currentChangeIndex + 1) % changeIndex.length;
    setCurrentChangeIndex(next);
    console.log("navigateNext", { changePos: next, arrayIndex: changeIndex[next] });
    scrollToRow(changeIndex[next]);
  }, [changeIndex, currentChangeIndex]);

  const navigatePrev = useCallback(() => {
    if (changeIndex.length === 0) return;
    const prev = currentChangeIndex <= 0 ? changeIndex.length - 1 : currentChangeIndex - 1;
    setCurrentChangeIndex(prev);
    console.log("navigatePrev", { changePos: prev, arrayIndex: changeIndex[prev] });
    scrollToRow(changeIndex[prev]);
  }, [changeIndex, currentChangeIndex]);

  // ── highlight cells toggle ─────────────────────────────────────────────
  const [highlightCells, setHighlightCells] = useState(true);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

      <HeaderBar
        fileAName={fileAName}
        fileBName={fileBName}
        summary={diffSummary}
        isLoading={isLoading}
        onInfoA={onShowDetailsA}
        onInfoB={onShowDetailsB}
      />

      {/* privacy banner */}
      <div className="privacy-banner">
        🔒 Your files are processed locally in your browser. Nothing is uploaded to any server.
      </div>

      {/* error banner */}
      {error && (
        <div
          style={{
            flexShrink: 0, padding: "8px 16px",
            background: "#2d1a1a", borderBottom: "1px solid #7f3535",
            color: "#f87171", fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* sub-toolbar — only when diff is present */}
      {diffResult && (
        <div
          style={{
            flexShrink: 0, display: "flex", alignItems: "center",
            gap: 16, padding: "4px 16px",
            background: "#0f172a", borderBottom: "1px solid #1e293b",
            fontSize: 12, color: "#64748b",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={highlightCells}
              onChange={(e) => setHighlightCells(e.target.checked)}
            />
            Highlight changed cells
          </label>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              onClick={onExportJson}
              style={{ padding: "2px 10px", background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 4, fontSize: 12 }}
            >
              Export JSON
            </button>
            <button
              onClick={onExportCsv}
              style={{ padding: "2px 10px", background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 4, fontSize: 12 }}
            >
              Export CSV
            </button>
          </div>
        </div>
      )}

      {/* split pane */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* File A pane */}
        <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
          <FilePane
            side="A"
            file={fileA}
            schema={fileA?.schema ?? null}
            unifiedRows={unifiedRows}
            currentChangeIndex={currentChangeIndex}
            changeIndex={changeIndex}
            scrollRef={scrollRefA}
            firstRowRef={firstRowRef}
            onFileLoaded={onFileALoaded}
            highlightCells={highlightCells}
          />
        </div>

        {/* divider */}
        <div style={{ width: 4, flexShrink: 0, background: "#334155" }} />

        {/* File B pane */}
        <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
          <FilePane
            side="B"
            file={fileB}
            schema={fileB?.schema ?? null}
            unifiedRows={unifiedRows}
            currentChangeIndex={currentChangeIndex}
            changeIndex={changeIndex}
            scrollRef={scrollRefB}
            onFileLoaded={onFileBLoaded}
            highlightCells={highlightCells}
          />
        </div>
      </div>

      {/* floating nav */}
      <FloatingNav
        currentChangeIndex={currentChangeIndex}
        totalChanges={changeIndex.length}
        onNext={navigateNext}
        onPrev={navigatePrev}
      />

      {/* details popups */}
      {showDetailsA && fileA && fileAName && (
        <DetailsPopup
          side="A"
          file={fileA}
          fileName={fileAName}
          primaryKeys={primaryKeys}
          ignoreColumns={ignoreColumns}
          schemaDiff={diffResult?.schemaDiff ?? null}
          onPrimaryKeysChange={onPrimaryKeysChange}
          onIgnoreColumnsChange={onIgnoreColumnsChange}
          onRerunDiff={onRerunDiff}
          onClose={onHideDetailsA}
        />
      )}

      {showDetailsB && fileB && fileBName && (
        <DetailsPopup
          side="B"
          file={fileB}
          fileName={fileBName}
          primaryKeys={primaryKeys}
          ignoreColumns={ignoreColumns}
          schemaDiff={diffResult?.schemaDiff ?? null}
          onPrimaryKeysChange={onPrimaryKeysChange}
          onIgnoreColumnsChange={onIgnoreColumnsChange}
          onRerunDiff={onRerunDiff}
          onClose={onHideDetailsB}
        />
      )}
    </div>
  );
}
