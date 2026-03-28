import { useEffect, useState } from "react";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import {
  diffCsvContent,
  exportDiffJson,
  getSummary,
  downloadFile,
} from "./lib/diffgraft";
import type { CsvReadResult, DiffConfig, DiffResult, DiffSummary } from "./types/diffgraft";

export default function App() {
  const [fileA,        setFileA]        = useState<CsvReadResult | null>(null);
  const [fileB,        setFileB]        = useState<CsvReadResult | null>(null);
  const [fileAName,    setFileAName]    = useState<string | null>(null);
  const [fileBName,    setFileBName]    = useState<string | null>(null);
  const [fileAContent, setFileAContent] = useState<string | null>(null);
  const [fileBContent, setFileBContent] = useState<string | null>(null);

  const [primaryKeys,   setPrimaryKeys]   = useState<string[]>([]);
  const [ignoreColumns, setIgnoreColumns] = useState<string[]>([]);

  // Incrementing this forces the auto-diff effect to re-run
  // even when primaryKeys/ignoreColumns haven't actually changed.
  const [diffKey, setDiffKey] = useState(0);

  const [diffResult,  setDiffResult]  = useState<DiffResult | null>(null);
  const [diffSummary, setDiffSummary] = useState<DiffSummary | null>(null);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const [showDetailsA, setShowDetailsA] = useState(false);
  const [showDetailsB, setShowDetailsB] = useState(false);

  // ── auto-diff ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!fileAContent || !fileBContent) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const config: DiffConfig = {
      primaryKeys,
      ignoreColumns,
      caseSensitive: false,
    };

    diffCsvContent(fileAContent, fileBContent, config)
      .then((result) => {
        if (cancelled) return;
        setDiffResult(result);
        return getSummary(result).then((summary) => {
          if (!cancelled) setDiffSummary(summary);
        });
      })
      .catch((e) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileAContent, fileBContent, primaryKeys, ignoreColumns, diffKey]);

  // ── file loaders ──────────────────────────────────────────────────────
  function handleFileALoaded(result: CsvReadResult, content: string, name: string) {
    setFileA(result);
    setFileAContent(content);
    setFileAName(name);
    if (result.primaryKeyCandidates.length > 0) {
      setPrimaryKeys([result.primaryKeyCandidates[0]]);
    }
    if (result.noiseColumns.length > 0) {
      setIgnoreColumns(result.noiseColumns);
    }
    setDiffResult(null);
    setDiffSummary(null);
  }

  function handleFileBLoaded(result: CsvReadResult, content: string, name: string) {
    setFileB(result);
    setFileBContent(content);
    setFileBName(name);
    if (primaryKeys.length === 0 && result.primaryKeyCandidates.length > 0) {
      setPrimaryKeys([result.primaryKeyCandidates[0]]);
    }
    setDiffResult(null);
    setDiffSummary(null);
  }

  // ── exports ───────────────────────────────────────────────────────────
  async function handleExportJson() {
    if (!diffResult) return;
    try {
      const json = await exportDiffJson(diffResult);
      downloadFile(json, "diff.json", "application/json");
    } catch (e) {
      setError(String(e));
    }
  }

  function handleExportCsv() {
    if (!fileAContent) return;
    downloadFile(fileAContent, "export.csv", "text/csv");
  }

  return (
    <WorkspaceLayout
      fileA={fileA}
      fileB={fileB}
      fileAName={fileAName}
      fileBName={fileBName}
      primaryKeys={primaryKeys}
      ignoreColumns={ignoreColumns}
      diffResult={diffResult}
      diffSummary={diffSummary}
      isLoading={isLoading}
      error={error}
      showDetailsA={showDetailsA}
      showDetailsB={showDetailsB}
      onFileALoaded={handleFileALoaded}
      onFileBLoaded={handleFileBLoaded}
      onPrimaryKeysChange={setPrimaryKeys}
      onIgnoreColumnsChange={setIgnoreColumns}
      onRerunDiff={() => setDiffKey((k) => k + 1)}
      onExportJson={handleExportJson}
      onExportCsv={handleExportCsv}
      onShowDetailsA={() => setShowDetailsA(true)}
      onShowDetailsB={() => setShowDetailsB(true)}
      onHideDetailsA={() => setShowDetailsA(false)}
      onHideDetailsB={() => setShowDetailsB(false)}
    />
  );
}
