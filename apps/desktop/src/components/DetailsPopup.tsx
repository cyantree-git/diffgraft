import type { CsvReadResult, SchemaDiff } from "../types/diffgraft";

interface Props {
  side: "A" | "B";
  file: CsvReadResult;
  fileName: string;
  primaryKeys: string[];
  ignoreColumns: string[];
  schemaDiff: SchemaDiff | null;
  onPrimaryKeysChange: (keys: string[]) => void;
  onIgnoreColumnsChange: (cols: string[]) => void;
  onRerunDiff: () => void;
  onClose: () => void;
}

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 6, height: 6,
        borderRadius: "50%",
        background: color,
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  );
}

export function DetailsPopup({
  side,
  file,
  fileName,
  primaryKeys,
  ignoreColumns,
  schemaDiff,
  onPrimaryKeysChange,
  onIgnoreColumnsChange,
  onRerunDiff,
  onClose,
}: Props) {
  const cols = file.schema.columns;
  const candidates = new Set(file.primaryKeyCandidates);
  const noiseCols  = new Set(file.noiseColumns);

  function toggleKey(name: string) {
    const next = new Set(primaryKeys);
    if (next.has(name)) next.delete(name); else next.add(name);
    onPrimaryKeysChange(Array.from(next));
  }

  function toggleIgnore(name: string) {
    const next = new Set(ignoreColumns);
    if (next.has(name)) next.delete(name); else next.add(name);
    onIgnoreColumnsChange(Array.from(next));
  }

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    top: 40,
    [side === "A" ? "left" : "right"]: 0,
    width: 320,
    height: "calc(100vh - 40px)",
    background: "#1e293b",
    borderRight: side === "A" ? "1px solid #334155" : undefined,
    borderLeft:  side === "B" ? "1px solid #334155" : undefined,
    display: "flex",
    flexDirection: "column",
    zIndex: 50,
    overflow: "hidden",
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 8,
  };

  const checkRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 0",
    fontSize: 13,
    color: "#e2e8f0",
  };

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 49,
          background: "rgba(0,0,0,0.35)",
        }}
      />

      {/* panel */}
      <div style={panelStyle}>
        {/* header */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #334155",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{fileName}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              {file.schema.columns.length} columns · {file.schema.rowCount.toLocaleString()} rows
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#64748b", fontSize: 18, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        {/* scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

          {/* Primary key */}
          <div style={{ marginBottom: 20 }}>
            <div style={sectionTitle}>Primary key columns</div>
            {cols.map((col) => (
              <label key={col.name} style={{ ...checkRow, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={primaryKeys.includes(col.name)}
                  onChange={() => toggleKey(col.name)}
                />
                {candidates.has(col.name) && <Dot color="#3b82f6" />}
                <span style={{ color: candidates.has(col.name) ? "#93c5fd" : "#e2e8f0" }}>
                  {col.name}
                </span>
              </label>
            ))}
            <p style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>
              Blue dot = auto-detected · Leave empty to diff by row order
            </p>
          </div>

          {/* Ignore columns */}
          <div style={{ marginBottom: 20 }}>
            <div style={sectionTitle}>Ignore columns</div>
            {cols.map((col) => (
              <label key={col.name} style={{ ...checkRow, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={ignoreColumns.includes(col.name)}
                  onChange={() => toggleIgnore(col.name)}
                />
                {noiseCols.has(col.name) && <Dot color="#f59e0b" />}
                <span>{col.name}</span>
              </label>
            ))}
            <p style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>
              Orange dot = auto-detected noise column
            </p>
          </div>

          {/* Schema diff */}
          {schemaDiff && (
            <div style={{ marginBottom: 20 }}>
              <div style={sectionTitle}>Schema diff</div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
                {schemaDiff.commonColumns.length} common columns
              </div>
              {schemaDiff.addedColumns.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: "#4ade80", fontSize: 12 }}>+ Added</span>
                  {schemaDiff.addedColumns.map((c) => (
                    <div key={c.name} style={{ fontSize: 13, color: "#4ade80", paddingLeft: 12 }}>{c.name}</div>
                  ))}
                </div>
              )}
              {schemaDiff.removedColumns.length > 0 && (
                <div>
                  <span style={{ color: "#f87171", fontSize: 12 }}>- Removed</span>
                  {schemaDiff.removedColumns.map((c) => (
                    <div key={c.name} style={{ fontSize: 13, color: "#f87171", paddingLeft: 12 }}>{c.name}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* footer: re-run */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #334155", flexShrink: 0 }}>
          <button
            onClick={() => { onRerunDiff(); onClose(); }}
            style={{
              width: "100%", padding: "8px 0",
              background: "#3b82f6", color: "#fff",
              border: "none", borderRadius: 6,
              fontSize: 13, fontWeight: 600,
            }}
          >
            Re-run Diff
          </button>
        </div>
      </div>
    </>
  );
}
