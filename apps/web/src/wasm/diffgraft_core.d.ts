export default function init(input?: string | URL | Request | BufferSource | WebAssembly.Module): Promise<void>;
export function wasm_read_csv(content: string): string;
export function wasm_diff_csv(content_a: string, content_b: string, config_json: string): string;
export function wasm_get_summary(result_json: string): string;
export function wasm_export_diff_json(result_json: string): string;
export function wasm_cherry_pick_merge(content_a: string, content_b: string, config_json: string, selections_json: string): string;
