import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CsvSchema, DiffConfig } from "../types/diffgraft";

interface Props {
  schema: CsvSchema;
  onConfigured: (config: DiffConfig) => void;
  disabled?: boolean;
}

export function PrimaryKeySelector({ schema, onConfigured, disabled }: Props) {
  const [candidates, setCandidates] = useState<string[]>([]);
  const [noiseColumns, setNoiseColumns] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [ignoredColumns, setIgnoredColumns] = useState<Set<string>>(new Set());
  const [noPrimaryKey, setNoPrimaryKey] = useState(false);

  useEffect(() => {
    invoke<string[]>("cmd_detect_primary_key_candidates", { schema }).then(
      (cols) => {
        setCandidates(cols);
        setSelectedKeys(new Set(cols));
      }
    );
    invoke<string[]>("cmd_detect_noise_columns", { schema }).then((cols) => {
      setNoiseColumns(cols);
      setIgnoredColumns(new Set(cols));
    });
  }, [schema]);

  function toggleKey(name: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleIgnore(name: string) {
    setIgnoredColumns((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleRun() {
    const config: DiffConfig = {
      primary_keys: noPrimaryKey ? [] : Array.from(selectedKeys),
      ignore_columns: Array.from(ignoredColumns),
      case_sensitive: false,
    };
    onConfigured(config);
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
      <h3 style={{ margin: "0 0 12px" }}>Configure Diff</h3>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={noPrimaryKey}
            onChange={(e) => setNoPrimaryKey(e.target.checked)}
          />
          No primary key (diff by row order)
        </label>
        {noPrimaryKey && (
          <p style={{ color: "#f59e0b", fontSize: "12px", margin: "4px 0 0 24px" }}>
            Order-based diff may produce misleading results if rows are reordered.
          </p>
        )}
      </div>

      {!noPrimaryKey && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontWeight: 500, marginBottom: "6px" }}>Primary key columns</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {schema.columns.map((col) => (
              <label
                key={col.name}
                style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}
              >
                <input
                  type="checkbox"
                  checked={selectedKeys.has(col.name)}
                  onChange={() => toggleKey(col.name)}
                />
                <span style={{ color: candidates.includes(col.name) ? "#4a90e2" : undefined }}>
                  {col.name}
                </span>
              </label>
            ))}
          </div>
          {candidates.length > 0 && (
            <p style={{ fontSize: "11px", color: "#888", margin: "4px 0 0" }}>
              Blue = auto-detected candidates
            </p>
          )}
        </div>
      )}

      {noiseColumns.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontWeight: 500, marginBottom: "6px" }}>Suggested columns to ignore</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {noiseColumns.map((col) => (
              <label
                key={col}
                style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}
              >
                <input
                  type="checkbox"
                  checked={ignoredColumns.has(col)}
                  onChange={() => toggleIgnore(col)}
                />
                {col}
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleRun}
        disabled={disabled}
        style={{
          padding: "8px 20px",
          background: "#4a90e2",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {disabled ? "Running..." : "Run Diff"}
      </button>
    </div>
  );
}
