# DiffGraft — Claude Code Instructions

## Read First
Always read CONTEXT.md before doing anything.

## Non-Negotiable Rules

### Rust
- No unwrap() or expect() anywhere in crates/
- No panic!() in production code paths
- Use ? operator and AppError everywhere
- Run cargo check after every file change
- Run cargo clippy before declaring any task complete
- All public functions must have doc comments

### Architecture
- diffgraft-core is platform agnostic — forever
- Never import tauri in diffgraft-core
- Never call std::fs in diffgraft-core
- Caller reads files, passes contents to core
- Core receives data, returns results
- This is what enables WASM compilation later

### Testing
- Every function in diff.rs needs a unit test
- Test with: empty CSV, single row, 1M rows, duplicate keys
- Never mark complete if cargo test is failing

### Git
- Branch naming: feat/*, fix/*, chore/*
- Conventional commits format
- Never commit directly to main

## Module Responsibilities
| Module    | Owns                        | Never touches     |
|-----------|-----------------------------|-------------------|
| reader.rs | CSV parsing, schema detect  | diff logic        |
| diff.rs   | structural diff engine      | file I/O          |
| merge.rs  | cherry-pick merge           | file I/O, diff    |
| export.rs | CSV/JSON output             | diff, merge logic |
| main.rs   | Tauri commands only         | business logic    |

## Current Status
Initial scaffold — nothing working yet
