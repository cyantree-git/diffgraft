import { useState } from "react";
import type { CsvReadResult } from "../types/diffgraft";
import { readCsv, openFileDialog } from "../lib/diffgraft";

interface Props {
  side: "A" | "B";
  onFileLoaded: (result: CsvReadResult, name: string) => void;
}

function CsvIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ marginBottom: 12 }}>
      <rect x="6" y="4" width="22" height="28" rx="2" stroke="#334155" strokeWidth="1.5" />
      <rect x="6" y="4" width="22" height="28" rx="2" fill="#1e293b" />
      <path d="M22 4v8h8" stroke="#334155" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="6" y="4" width="16" height="28" rx="2" fill="#1e293b" />
      <rect x="6" y="4" width="16" height="28" rx="2" stroke="#334155" strokeWidth="1.5" />
      <line x1="10" y1="14" x2="18" y2="14" stroke="#475569" strokeWidth="1" />
      <line x1="10" y1="18" x2="18" y2="18" stroke="#475569" strokeWidth="1" />
      <line x1="10" y1="22" x2="16" y2="22" stroke="#475569" strokeWidth="1" />
    </svg>
  );
}

export function DropZone({ side, onFileLoaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadFromPath(path: string, name: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await readCsv(path);
      onFileLoaded(result, name);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleClick() {
    const path = await openFileDialog();
    if (!path) return;
    const name = path.replace(/\\/g, "/").split("/").pop() ?? path;
    await loadFromPath(path, name);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave() {
    setDragging(false);
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Only .csv files are supported.");
      return;
    }
    const path = (file as File & { path?: string }).path;
    if (!path) {
      setError("Could not determine file path. Try using the click-to-open button.");
      return;
    }
    await loadFromPath(path, file.name);
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={handleClick}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        border: `2px dashed ${dragging ? "#3b82f6" : "#334155"}`,
        background: dragging ? "rgba(59,130,246,0.05)" : "transparent",
        borderRadius: 8,
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
        userSelect: "none",
      }}
    >
      {loading ? (
        <span style={{ color: "#64748b", fontSize: 14 }}>Loading…</span>
      ) : (
        <>
          <CsvIcon />
          <span style={{ color: "#94a3b8", fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
            Drop File {side} here
          </span>
          <span style={{ color: "#475569", fontSize: 13 }}>or click to open</span>
          {error && (
            <span style={{ color: "#f87171", fontSize: 12, marginTop: 12, maxWidth: 260, textAlign: "center" }}>
              {error}
            </span>
          )}
        </>
      )}
    </div>
  );
}
