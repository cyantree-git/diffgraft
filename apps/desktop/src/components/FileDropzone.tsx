import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CsvSchema, Row } from "../types/diffgraft";

interface Props {
  onFileLoaded: (schema: CsvSchema, rows: Row[]) => void;
  onFileLoaded2: (schema: CsvSchema, rows: Row[]) => void;
}

interface DropZoneProps {
  label: string;
  onLoaded: (schema: CsvSchema, rows: Row[]) => void;
}

function SingleDropZone({ label, onLoaded }: DropZoneProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (filePath: string, name: string) => {
      setError(null);
      try {
        const [schema, rows] = await invoke<[CsvSchema, Row[]]>("cmd_read_csv", {
          path: filePath,
        });
        setFileName(name);
        setRowCount(schema.rowCount);
        onLoaded(schema, rows);
      } catch (e) {
        setError(String(e));
      }
    },
    [onLoaded]
  );

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave() {
    setDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      setError("Only .csv files are supported.");
      return;
    }
    // In Tauri, the drop event gives us a native path via the file object.
    handleFile((file as File & { path?: string }).path ?? file.name, file.name);
  }

  const borderColor = dragging ? "#4a90e2" : "#ccc";
  const bg = dragging ? "#eef4ff" : "#fafafa";

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        flex: 1,
        border: `2px dashed ${borderColor}`,
        borderRadius: "8px",
        padding: "32px 16px",
        textAlign: "center",
        background: bg,
        transition: "border-color 0.15s, background 0.15s",
        cursor: "default",
      }}
    >
      <div style={{ fontSize: "13px", color: "#888", marginBottom: "8px" }}>
        {label}
      </div>
      {fileName ? (
        <div>
          <div style={{ fontWeight: 600 }}>{fileName}</div>
          <div style={{ color: "#666", fontSize: "12px" }}>
            {rowCount?.toLocaleString()} rows
          </div>
        </div>
      ) : (
        <div style={{ color: "#bbb" }}>Drop a .csv file here</div>
      )}
      {error && <div style={{ color: "red", fontSize: "12px", marginTop: "8px" }}>{error}</div>}
    </div>
  );
}

export function FileDropzone({ onFileLoaded, onFileLoaded2 }: Props) {
  return (
    <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
      <SingleDropZone label="File A" onLoaded={onFileLoaded} />
      <SingleDropZone label="File B" onLoaded={onFileLoaded2} />
    </div>
  );
}
