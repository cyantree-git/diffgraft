import { useState } from "react";
import { PrimaryKeySelector } from "./components/PrimaryKeySelector";
import { SchemaDiff } from "./components/SchemaDiff";
import { DiffTable } from "./components/DiffTable";
import { Attribution } from "./components/Attribution";
import {
  openFileDialog,
  readCsv,
  diffCsv,
  getSummary,
  exportDiffJson,
  exportCsv,
} from "./lib/diffgraft";
import type {
  CsvReadResult,
  DiffConfig,
  DiffResult,
  DiffSummary,
} from "./types/diffgraft";

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface FileSlotProps {
  label: string;
  file: CsvReadResult | null;
  onOpen: () => void;
  disabled: boolean;
}

function FileSlot({ label, file, onOpen, disabled }: FileSlotProps) {
  return (
    <div
      style={{
        flex: 1,
        border: "1px solid #333",
        borderRadius: "8px",
        padding: "16px",
        minWidth: 0,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "8px", color: "#aaa", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      {file ? (
        <div>
          <div style={{ fontSize: "13px", color: "#e0e0e0", wordBreak: "break-all" }}>
            {file.schema.columns.length} columns · {file.schema.row_count} rows
          </div>
          <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {file.schema.columns.slice(0, 6).map((c) => (
              <span key={c.name} style={{ background: "#2a2a2a", border: "1px solid #444", borderRadius: "4px", padding: "2px 6px", fontSize: "11px", color: "#bbb" }}>
                {c.name}
              </span>
            ))}
            {file.schema.columns.length > 6 && (
              <span style={{ fontSize: "11px", color: "#666" }}>+{file.schema.columns.length - 6} more</span>
            )}
          </div>
        </div>
      ) : (
        <div style={{ color: "#555", fontSize: "13px" }}>No file loaded</div>
      )}
      <button
        onClick={onOpen}
        disabled={disabled}
        style={{
          marginTop: "10px",
          padding: "6px 14px",
          background: file ? "#2a2a2a" : "#4a90e2",
          color: file ? "#aaa" : "#fff",
          border: file ? "1px solid #444" : "none",
          borderRadius: "6px",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: "13px",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {file ? "Change file" : "Open file"}
      </button>
    </div>
  );
}

export default function App() {
  const [fileA, setFileA] = useState<CsvReadResult | null>(null);
  const [fileB, setFileB] = useState<CsvReadResult | null>(null);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [diffSummary, setDiffSummary] = useState<DiffSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpenFile(slot: "A" | "B") {
    setError(null);
    const path = await openFileDialog();
    if (!path) return;
    setIsLoading(true);
    try {
      const result = await readCsv(path);
      if (slot === "A") {
        setFileA(result);
        setDiffResult(null);
        setDiffSummary(null);
      } else {
        setFileB(result);
        setDiffResult(null);
        setDiffSummary(null);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRunDiff(config: DiffConfig) {
    if (!fileA || !fileB) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await diffCsv(fileA.rows, fileB.rows, fileA.schema, fileB.schema, config);
      setDiffResult(result);
      const summary = await getSummary(result);
      setDiffSummary(summary);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExportJson() {
    if (!diffResult) return;
    try {
      const json = await exportDiffJson(diffResult);
      downloadFile(json, "diff.json", "application/json");
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleExportCsv() {
    if (!diffResult || !fileA) return;
    try {
      const csv = await exportCsv(fileA.rows, fileA.schema);
      downloadFile(csv, "export.csv", "text/csv");
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: "24px",
        maxWidth: "1200px",
        margin: "0 auto",
        color: "#e0e0e0",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 700 }}>DiffGraft</h1>
      <p style={{ color: "#666", marginTop: 0, marginBottom: "24px", fontSize: "13px" }}>
        Open two CSV files. See exactly what changed.
      </p>

      <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
        <FileSlot label="File A (base)" file={fileA} onOpen={() => handleOpenFile("A")} disabled={isLoading} />
        <FileSlot label="File B (changed)" file={fileB} onOpen={() => handleOpenFile("B")} disabled={isLoading} />
      </div>

      {error && (
        <div
          style={{
            background: "#2d1a1a",
            border: "1px solid #7f3535",
            borderRadius: "6px",
            padding: "10px 14px",
            color: "#f87171",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {fileA && fileB && (
        <PrimaryKeySelector
          schema={fileA.schema}
          initialCandidates={fileA.primary_key_candidates}
          initialNoise={fileA.noise_columns}
          onConfigured={handleRunDiff}
          disabled={isLoading}
        />
      )}

      {diffSummary && (
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginBottom: "16px",
            padding: "12px 16px",
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "8px",
            fontSize: "13px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "#4ade80" }}>+{diffSummary.added} added</span>
          <span style={{ color: "#f87171" }}>-{diffSummary.deleted} deleted</span>
          <span style={{ color: "#facc15" }}>~{diffSummary.modified} modified</span>
          <span style={{ color: "#888" }}>{diffSummary.unchanged} unchanged</span>
          {diffSummary.has_schema_changes && (
            <span style={{ color: "#c084fc" }}>
              {diffSummary.schema_changes_count} schema change{diffSummary.schema_changes_count !== 1 ? "s" : ""}
            </span>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
            <button
              onClick={handleExportJson}
              style={{
                padding: "4px 12px",
                background: "#2a2a2a",
                color: "#aaa",
                border: "1px solid #444",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Export JSON
            </button>
            <button
              onClick={handleExportCsv}
              style={{
                padding: "4px 12px",
                background: "#2a2a2a",
                color: "#aaa",
                border: "1px solid #444",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Export CSV
            </button>
          </div>
        </div>
      )}

      {diffResult && (
        <>
          <SchemaDiff schemaDiff={diffResult.schema_diff} />
          <DiffTable result={diffResult} />
        </>
      )}

      {!fileA && !fileB && (
        <p style={{ color: "#444", marginTop: "60px", textAlign: "center", fontSize: "14px" }}>
          Open two CSV files above to get started.
        </p>
      )}

      <Attribution />
    </div>
  );
}
