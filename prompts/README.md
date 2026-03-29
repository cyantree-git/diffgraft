# DiffGraft — Development Prompts

This directory contains the Claude Code prompts used to build DiffGraft.

DiffGraft was built using AI-assisted development. These prompts are
published intentionally — they document the architectural decisions,
constraints, and reasoning behind each feature.

Prompt engineering is a skill. These prompts show:
- How to specify Rust module boundaries precisely
- How to enforce architectural constraints via prompts
- How to structure test requirements before implementation
- How to incrementally build a complex system

The diff engine architecture, the WASM/native split, the camelCase
serialisation decision, the scroll sync approach — these were all
human decisions specified in prompts before a line of code was written.

If you're building developer tools with AI assistance, these prompts
may help you work more effectively.

