import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileDropzone } from "./components/FileDropzone";
import { PrimaryKeySelector } from "./components/PrimaryKeySelector";
import { SchemaDiff } from "./components/SchemaDiff";
import { DiffTable } from "./components/DiffTable";
import { Attribution } from "./components/Attribution";
import type {
  CsvSchema,
  DiffConfig,
  DiffResult,
  Row,
} from "./types/diffgraft";

type LoadedFile = { schema: CsvSchema; rows: Row[] };

export default function App() {
  const [fileA, setFileA] = useState<LoadedFile | null>(null);
  const [fileB, setFileB] = useState<LoadedFile | null>(null);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const canDiff = fileA !== null && fileB !== null;

  async function runDiff(config: DiffConfig) {
    if (!fileA || !fileB) return;
    setRunning(true);
    setError(null);
    try {
      const result = await invoke<DiffResult>("cmd_diff_csv", {
        rowsA: fileA.rows,
        rowsB: fileB.rows,
        schemaA: fileA.schema,
        schemaB: fileB.schema,
        config,
      });
      setDiffResult(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "4px" }}>DiffGraft</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Open two CSV files. See exactly what changed.
      </p>

      <FileDropzone
        onFileLoaded={(schema, rows) => setFileA({ schema, rows })}
        onFileLoaded2={(schema, rows) => setFileB({ schema, rows })}
      />

      {error && (
        <div style={{ color: "red", margin: "12px 0" }}>{error}</div>
      )}

      {fileA && fileB && (
        <PrimaryKeySelector
          schema={fileA.schema}
          onConfigured={runDiff}
          disabled={running}
        />
      )}

      {diffResult && (
        <>
          <SchemaDiff schemaDiff={diffResult.schema_diff} />
          <DiffTable result={diffResult} />
        </>
      )}

      {!canDiff && !diffResult && (
        <p style={{ color: "#aaa", marginTop: "40px", textAlign: "center" }}>
          Drop two CSV files above to get started.
        </p>
      )}

      <Attribution />
    </div>
  );
}
