# ADR-0007: Gemini as a second live AI provider
Status: accepted · 2026-11-26

**Context:** The demo must run live, and the available key is a Google Gemini key, not an Anthropic key. ADR-0003 already puts the model behind `Extractor` and `EmailWriter` interfaces.

**Decision:** Add `GeminiExtractor` and `GeminiEmailWriter`, selected with `LIENGUARD_AI=gemini` (`GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_MAX_CONCURRENCY`). The Anthropic versions stay unchanged and selectable.
- Same contract: one request per PDF, the PDF sent inline (base64, `application/pdf`), structured JSON output (`responseMimeType: application/json` + `responseJsonSchema` generated from the same Zod schema), Zod re-validation, one retry with feedback, then needsReview. The extraction and email prompts are shared with the Anthropic versions, so behaviour differs only by model.
- Placeholders and the email post-check are unchanged: the provider never sees or writes real amounts or dates.
- Free tier: rate limits are per project and can be low, so calls go through a per-instance concurrency limit (default 2) and exponential backoff on 429/503 (2s, 4s, 8s, 16s; 4 retries). Other errors fail fast. The browser queue still sends one PDF per request.
- Model: `gemini-4-hydrogen` by default (Google's current document-processing examples use it); override with `GEMINI_MODEL`. Checked live with `pnpm smoke:gemini --models`.

**Consequences:**
- Tests and CI stay offline: the Gemini classes take an injected `generate` function, faked in tests.
- Extraction quality may differ between providers. `pnpm smoke:gemini` compares live Gemini readings field by field with the recorded fixtures; low-confidence or wrong-looking fields still go to needsReview → HOLD, so a weaker read fails safe.
- Extractions are cached by file hash regardless of provider. After switching provider, clear `ExtractionCache` if a fresh read is wanted.

Sources: ai.google.dev/gemini-api/docs (models, document-processing, structured-output, rate-limits, api-key), read 2026-11-26.
