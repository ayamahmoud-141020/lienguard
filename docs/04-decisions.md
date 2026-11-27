# Decisions

Each architecture decision record (ADR) is in [decisions/](decisions/). This page gives each one in two or three lines.

| ADR | Decision, in short |
|---|---|
| [0001 Rules in code, not in the LLM](decisions/0001-rules-in-code.md) | Every SAFE/HOLD rule is a pure TypeScript function with unit tests. The model only reads PDFs and writes email wording; it never decides and never computes amounts. Changing a rule means changing code and tests, not a prompt. |
| [0002 Money as integer cents, dates as ISO strings](decisions/0002-money-as-cents.md) | Amounts are integer cents, so there are no floating-point errors. Business dates are `YYYY-MM-DD` with no time zone. The model returns raw text and code parses it; a parse failure means needs review. |
| [0003 LLM behind interfaces; fixtures in tests](decisions/0003-llm-behind-interfaces.md) | The extractor, the email writer and the sender are interfaces with a real and a fake version, chosen by environment variable. Tests and CI always use the fakes, so they are fast, free and need no network. |
| [0004 Extraction cached by file hash](decisions/0004-extraction-cache.md) | Each PDF's reading is stored under the SHA-256 of its bytes, so the same file is never sent to the model twice. Re-running a batch is free and gives the same result. |
| [0005 Human approval before any email is sent](decisions/0005-human-approval-before-send.md) | Drafts start as `draft`, and only a person's click makes them `approved`; only approved drafts can be sent. Numbers come from code-filled placeholders and a post-check. Sending is idempotent, and demo emails are redirected to one inbox. |
| [0006 Postgres on Neon; PDFs in the database](decisions/0006-postgres-neon.md) | Vercel's file system does not keep files, so data is in Neon Postgres through Prisma 6. PDFs of up to 4 MB, one per request, are stored as `bytea`, so no separate file store is needed. |
| [0007 Gemini as a second AI provider](decisions/0007-gemini-provider.md) | The available key at the time was a Gemini key, so Gemini was added behind the same interfaces, with the same schema and post-check. Free-tier limits led to a concurrency limit and backoff. The first model's free quota was 20 requests a day; `gemini-3.5-flash-lite` became the default. |
| [0008 UI on shadcn/ui dashboard-01](decisions/0008-ui-template.md) | The UI was rebuilt on shadcn/ui's `dashboard-01` block (MIT), chosen over Tremor and shadcn-admin after reading their licences. Chart data and email highlighting are pure, tested functions; the components only draw them. |
| [0009 Claude in production; sample emails recorded](decisions/0009-claude-in-production.md) | After the Gemini free quota ran out, production switched to Claude (`claude-opus-5-5`, low effort) on a prepaid key. Sample batches make no AI calls at all. An uploaded PDF costs about 3.4 cents to read. |

S-24 added a code check that AI values must appear in the PDF's text. It has no ADR of its own; the decision and its limits are written down in requirement R-23 of the [spec](features/001-lienguard.md#4-requirements).
