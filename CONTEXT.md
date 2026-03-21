# DiffGraft

Free, open-source structural diff tool for data files.
Open two files. See exactly what changed. Nothing else.

## Mission
Structural diff intelligence for CSV, Parquet and JSON.
Not line-by-line text comparison.
Column-aware, row-aware, schema-aware, primary-key-aware.

## v1 Scope — CSV only
- Open two CSV files (web + desktop)
- Primary key detection (single + composite)
- Auto-detect primary key candidates
- Auto-detect and suggest ignoring noise columns
- Schema diff
- Row diff: added, deleted, modified
- Cell-level change highlighting
- Cherry-pick merge
- Export merged result as CSV
- Export diff as JSON
- Attribution: built by th4t.dev/sid
- Data never leaves the browser (web version)
- Performance: 1M rows under 2 seconds

## Stack
- Tauri v2 (desktop shell)
- Rust + csv crate (core diff engine)
- React + TypeScript + Vite (UI)
- wasm-bindgen (web version, future)
- serde + serde_json

## Architecture Rules
- diffgraft-core has ZERO platform dependencies
- No Tauri imports in diffgraft-core
- No filesystem calls in diffgraft-core
  (caller passes file contents, core returns results)
- All Tauri commands in main.rs only
- React owns rendering, Rust owns computation
- No unwrap() or expect() in production code
- No panic!() in production code paths

## Modules
- reader.rs   read CSV, detect schema, detect key candidates
- diff.rs     structural diff engine
- merge.rs    cherry-pick merge engine
- export.rs   write merged output

## Performance Requirements
- 1M row CSV diff: under 2 seconds
- 200MB CSV: under 5 seconds
- Memory: never more than 2x file size

## Domain
diffgraft.io + diffgraft.com

## Company
CyanTree (cyantree.co.uk)

## Attribution
All UI surfaces show: "built by th4t.dev/sid"
Bottom right corner, low opacity, links to https://th4t.dev/sid

## License
Apache 2.0
