import type { DiffSummary } from "../types/diffgraft";

interface Props {
  fileAName: string | null;
  fileBName: string | null;
  summary: DiffSummary | null;
  isLoading: boolean;
  onInfoA: () => void;
  onInfoB: () => void;
}

const infoBtn: React.CSSProperties = {
  width: 24, height: 24, padding: 0,
  background: "#334155", color: "#94a3b8",
  border: "none", borderRadius: 4,
  fontSize: 12, fontWeight: 700,
  cursor: "pointer", flexShrink: 0,
};

export function HeaderBar({ fileAName, fileBName, summary, isLoading, onInfoA, onInfoB }: Props) {
  return (
    <div
      style={{
        height: 40, flexShrink: 0,
        display: "flex", alignItems: "center",
        background: "#1e293b",
        borderBottom: "1px solid #334155",
        padding: "0 16px",
        fontSize: 13,
        gap: 0,
      }}
    >
      {/* Left: File A */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {fileAName && (
          <button style={infoBtn} onClick={onInfoA} title="File A info & settings">ⓘ</button>
        )}
        <span
          style={{
            color: fileAName ? "#e2e8f0" : "#475569",
            fontWeight: fileAName ? 500 : 400,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {fileAName ?? "Drop a file"}
        </span>
      </div>

      {/* Centre: summary */}
      <div
        style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          gap: 16, flexShrink: 0,
        }}
      >
        {isLoading && <span style={{ color: "#64748b" }}>Diffing…</span>}
        {!isLoading && summary && (
          <>
            <span style={{ color: "#4ade80", fontWeight: 600 }}>+{summary.added}</span>
            <span style={{ color: "#f87171", fontWeight: 600 }}>-{summary.deleted}</span>
            <span style={{ color: "#fb923c", fontWeight: 600 }}>~{summary.modified}</span>
            <span style={{ color: "#64748b" }}>{summary.unchanged}</span>
          </>
        )}
        {!isLoading && !summary && fileAName && fileBName && (
          <span style={{ color: "#475569" }}>—</span>
        )}
      </div>

      {/* Right: File B */}
      <div
        style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end",
          gap: 8, minWidth: 0,
        }}
      >
        <span
          style={{
            color: fileBName ? "#e2e8f0" : "#475569",
            fontWeight: fileBName ? 500 : 400,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {fileBName ?? "Drop a file"}
        </span>
        {fileBName && (
          <button style={infoBtn} onClick={onInfoB} title="File B info & settings">ⓘ</button>
        )}
      </div>
    </div>
  );
}
