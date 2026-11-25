# ADR-0004: Extraction cached by SHA-256 of file bytes
Status: accepted · 2026-11-25
**Decision:** Each PDF's extraction result is stored with the SHA-256 of its bytes. The same file is never sent to the model twice.
**Consequences:** Re-running a batch is free and gives identical results (idempotent). Re-running rules needs no LLM call.
