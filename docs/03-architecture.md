# Architecture

To watch these parts work step by step, open the system flows page at `/flows` on the live app (https://lienguard-one.vercel.app/flows). Its data, [`src/flows/flows.ts`](../src/flows/flows.ts), names the file behind every step and is tested against the repo.

## Components

| Component | What it does | Where |
|---|---|---|
| Web UI | Home, batch dashboard, payment detail, emails, audit log, system flows. Next.js App Router with shadcn/ui. | [`src/app/`](../src/app/), [`src/components/`](../src/components/) |
| API routes | Sample batch, uploads, extraction one PDF per request, evaluation, drafts, inbound, cron, health | [`src/app/api/`](../src/app/api/) |
| Ingest | Spreadsheets → typed rows, checked with Zod, with errors per row | [`src/ingest/spreadsheets.ts`](../src/ingest/spreadsheets.ts) |
| AI extractor | Reads one PDF into a schema. Claude or Gemini in production; recorded readings in tests | [`src/ai/`](../src/ai/) |
| Grounding check | Every value the AI read must appear in the PDF's own text | [`src/ai/grounding.ts`](../src/ai/grounding.ts) |
| Domain | Money, dates, matching, rules, exposure. Pure functions: no I/O, no clock | [`src/domain/`](../src/domain/) |
| Pipeline | Extract → match → rules for a whole batch | [`src/pipeline/`](../src/pipeline/) |
| Email | Writer (AI or recorded), post-check, code template, sender (Resend or fake) | [`src/email/`](../src/email/) |
| Automation | Inbound documents, daily check, reminders, notifications, digest | [`src/automation/`](../src/automation/) |
| Server glue | Passcode, upload checks, health, database access | [`src/server/`](../src/server/) |
| Database | Postgres on Neon through Prisma 6 | [`prisma/schema.prisma`](../prisma/schema.prisma) |

## Data model

Five tables, in [`prisma/schema.prisma`](../prisma/schema.prisma):

| Table | Holds |
|---|---|
| `Batch` | Name, kind (sample or upload), status (processing, ready, failed), the batch's `today`, the ingested spreadsheets as JSON, and the last result |
| `Document` | One PDF: file name, SHA-256, the bytes, status (queued, done, needs_review), and the AI reading. Unique per batch and hash, so the same file is stored once per batch |
| `ExtractionCache` | One reading per file hash, so the same bytes are never sent to the model twice ([ADR-0004](decisions/0004-extraction-cache.md)) |
| `EmailDraft` | One follow-up or reminder per subcontractor: body, status (draft, approved, skipped, sent, failed), who approved it, the provider's message id |
| `AuditLog` | Every action: who, what, on which record, when |

Payments, projects and subcontractors are not separate tables. They stay in `Batch.inputJson`, typed by [`src/ingest/spreadsheets.ts`](../src/ingest/spreadsheets.ts). Money is always integer cents and business dates are `YYYY-MM-DD` strings ([ADR-0002](decisions/0002-money-as-cents.md)).

## Pipeline

1. **Ingest.** The two spreadsheets become payments, projects and subcontractors ([`src/ingest/spreadsheets.ts`](../src/ingest/spreadsheets.ts)).
2. **Extract.** Each PDF is read by the configured extractor, one request per PDF. The reading is cached by file hash ([`src/ai/cache.ts`](../src/ai/cache.ts)).
3. **Ground.** The PDF's text is taken out by code ([`src/ai/pdf-text.ts`](../src/ai/pdf-text.ts)). Any value not found in it gets confidence 0 ([`src/ai/grounded-extractor.ts`](../src/ai/grounded-extractor.ts)). This runs after the cache, so older cached readings are checked too.
4. **Normalise.** Code parses amounts into cents and dates into ISO. Missing, unclear (below 0.7) or unparseable values mark the document needs review ([`src/ai/to-document.ts`](../src/ai/to-document.ts)).
5. **Match.** Waivers go to a subcontractor, project and payment; COIs go to a subcontractor ([`src/domain/matching/match.ts`](../src/domain/matching/match.ts)).
6. **Rules.** Each payment gets SAFE or HOLD, its findings and its exposure ([`src/domain/rules/index.ts`](../src/domain/rules/index.ts)). The whole batch is one pure function, `evaluateBatch` ([`src/pipeline/evaluate.ts`](../src/pipeline/evaluate.ts)).

## Where AI is used, and where it isn't

| Step | Done by |
|---|---|
| Reading messy PDFs | **AI.** Claude (`claude-opus-5-5`, low effort) in production ([ADR-0009](decisions/0009-claude-in-production.md)), or Gemini ([ADR-0007](decisions/0007-gemini-provider.md)) |
| Checking that what the AI read is in the PDF | Code ([`src/ai/grounding.ts`](../src/ai/grounding.ts)) |
| Parsing money and dates | Code ([`src/domain/money.ts`](../src/domain/money.ts), [`src/domain/dates.ts`](../src/domain/dates.ts)) |
| Matching, rules, exposure, SAFE/HOLD | Code ([ADR-0001](decisions/0001-rules-in-code.md)) |
| Email wording | **AI**, with placeholders only ([`src/email/writer.ts`](../src/email/writer.ts)) |
| Numbers in emails | Code fills the placeholders; a post-check rejects any amount or date not in the data ([`src/email/postcheck.ts`](../src/email/postcheck.ts)) |
| Reminders and the digest | Code ([`src/automation/reminders.ts`](../src/automation/reminders.ts), [`src/automation/digest.ts`](../src/automation/digest.ts)) |
| Sending to a subcontractor | A person approves every email ([ADR-0005](decisions/0005-human-approval-before-send.md)) |

## Rules

All rules are in [`src/domain/rules/index.ts`](../src/domain/rules/index.ts), with the state settings in [`config/states.json`](../config/states.json): TX needs a notary, CA and AZ don't, and the grace period is 5 days. The examples come from the rule tests ([`tests/unit/rules.test.ts`](../tests/unit/rules.test.ts), AC-7.1 to AC-7.9). Unless an example says otherwise, the payment is $20,000, paid on 2026-11-14 for work through 2026-10-31, on an AZ project, and today is 2026-11-20.

| Rule | HOLD when | Example | Exposure |
|---|---|---|---|
| R01 | There is no waiver | No waiver on file → HOLD, $20,000 exposed. If the payment is unpaid → HOLD, $0 exposed | The paid amount |
| R02 | The waiver amount is less than the payment | Waiver for $18,000 → HOLD, $2,000 exposed | The difference |
| R03 | Paid more than 5 days ago, with only a conditional waiver | Paid 2026-11-06 (14 days ago), conditional waiver → HOLD. Paid 2026-11-15 (5 days ago) → no R03 | The paid amount |
| R04 | The waiver's through date is before the period end | Waiver through 2026-09-30 → HOLD | The paid amount |
| R05 | The waiver is not signed | Unsigned waiver → HOLD | The paid amount |
| R06 | The state needs a notary and the waiver isn't notarized | Same waiver on a TX project, not notarized → HOLD; on AZ → no R06 | The paid amount |
| R07 | A final payment has only a progress waiver | Final payment, progress waiver → HOLD | The paid amount |
| R09 | No COI, or the COI expired before the payment date | COI expired 2026-11-10, paid 2026-11-15 → HOLD | $0 (a reason to hold, not a lien exposure) |
| R12 | The matched waiver needs review | The AI was unsure of a field → HOLD, its other values are not used | The paid amount |

A payment's exposure is its largest finding, not the sum: $18,000 through 2026-09-30 gives R02 and R04, and $20,000 exposed (AC-7.12). The batch's exposure is the sum over its payments. Rules R08, R10, R11 and R13 are not built (spec §3).

## Automation

The loop: a document arrives → the AI reads it → the rules re-run → a status changes → notify, or draft a reminder → a person approves.

| Part | How it works | Where |
|---|---|---|
| Inbound | `POST /api/inbound` with the `x-inbound-secret` header takes one PDF for a batch. The batch is re-checked and every decision change is recorded. A flip from HOLD to SAFE notifies the AP inbox | [`src/app/api/inbound/route.ts`](../src/app/api/inbound/route.ts), [`src/automation/engine.ts`](../src/automation/engine.ts) |
| Daily cron | Vercel Cron calls `/api/cron/daily` at 07:00 UTC with `Authorization: Bearer <CRON_SECRET>`. Every ready batch is re-checked with the real date. A batch's date never moves backwards | [`vercel.json`](../vercel.json), [`src/app/api/cron/daily/route.ts`](../src/app/api/cron/daily/route.ts) |
| Reminders | A reminder draft for each subcontractor who sent nothing within 3 days of our email. Never sent automatically | [`src/automation/reminders.ts`](../src/automation/reminders.ts) |
| Digest | One email per run to the AP inbox: new holds, cleared holds, dollars exposed, drafts waiting. Its numbers are checked against the data first | [`src/automation/digest.ts`](../src/automation/digest.ts) |
| Activity timeline | Every event on the batch page, marked "Automation" or with the person's name | [`src/view/activity.ts`](../src/view/activity.ts) |

Only the notification and the digest, which go to the GC's own AP inbox, are sent automatically. Emails to subcontractors always wait for a person.
