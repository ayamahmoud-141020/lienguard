# ADR-0009: Claude reads uploads in production; sample emails are recorded

- Status: accepted (2026-11-26, Aya)
- Context: ADR-0007 added Gemini for its free tier. On 2026-11-26 the free daily quota ran out (429) and some models returned 503 under load, so live uploads and drafting could fail during a demo. Aya added a prepaid Anthropic key ($5, no auto-reload).

## Decision
- Production sets `LIENGUARD_AI=anthropic` with `claude-opus-5-5` at low effort. Gemini stays a supported provider (`LIENGUARD_AI=gemini`).
- Sample batches make no AI calls at all: readings come from the hand-checked fixtures (AC-13.1) and the email wording from `samples/drafts/`, recorded once from live runs (3 by Gemini, 3 by Claude) and still filled and post-checked by code (S-21).
- Every live reading stays cached by file hash (DB in the app, `.cache/readings/` in the smoke script), so a PDF is never paid for twice.

## Consequences
- Cost per uploaded PDF is about 3.4 cents (smoke run: $0.58 for 17 PDFs, 105/106 fields correct). The prepaid balance caps the spend; when it runs out the API errors and documents go to needs review → HOLD, never a silent pass.
- Uploaded batches draft emails live with Claude, so their wording varies from run to run; the post-check and human approval are unchanged.
