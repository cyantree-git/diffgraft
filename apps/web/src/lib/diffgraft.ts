import type {
  CsvReadResult,
  DiffConfig,
  DiffResult,
  DiffSummary,
  MergeConfig,
  MergeResult,
  CellSelection,
} from '../types/diffgraft'

import type * as WasmModule from '../wasm/diffgraft_core.js'

let wasmInstance: typeof WasmModule | null = null

async function getWasm(): Promise<typeof WasmModule> {
  if (wasmInstance) return wasmInstance
  const module = await import('../wasm/diffgraft_core.js')
  await module.default()
  wasmInstance = module
  return wasmInstance
}

export async function readCsvContent(
  content: string
): Promise<CsvReadResult> {
  const w = await getWasm()
  const json = w.wasm_read_csv(content)
  return JSON.parse(json)
}

export async function diffCsvContent(
  contentA: string,
  contentB: string,
  config: DiffConfig
): Promise<DiffResult> {
  const w = await getWasm()
  const json = w.wasm_diff_csv(contentA, contentB, JSON.stringify(config))
  return JSON.parse(json)
}

export async function getSummary(
  result: DiffResult
): Promise<DiffSummary> {
  const w = await getWasm()
  const json = w.wasm_get_summary(JSON.stringify(result))
  return JSON.parse(json)
}

export async function exportDiffJson(
  result: DiffResult
): Promise<string> {
  const w = await getWasm()
  return w.wasm_export_diff_json(JSON.stringify(result))
}

export async function cherryPickMerge(
  contentA: string,
  contentB: string,
  config: MergeConfig,
  selections: CellSelection[]
): Promise<MergeResult> {
  const w = await getWasm()
  const json = w.wasm_cherry_pick_merge(
    contentA,
    contentB,
    JSON.stringify(config),
    JSON.stringify(selections)
  )
  return JSON.parse(json)
}

export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
