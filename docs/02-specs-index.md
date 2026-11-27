# Specs index

All stories belong to one feature: [features/001-lienguard.md](features/001-lienguard.md). The AC count is taken from §5 of that file. The test count is the number of tests whose name starts with one of the story's AC ids. Both counts are re-checked by [`tests/unit/docs.test.ts`](../tests/unit/docs.test.ts), together with the number of check reports. There are 15 check reports in [checks/](checks/).

"Audit" gives the number of audit rounds and the last verdict. A FAIL that only names ACs code can't test (manual, or the build checked by CI) was closed by Aya's sign-off, recorded in [§11 of the spec](features/001-lienguard.md#11-sign-off-on-items-without-an-automated-test-2026-11-26-aya-in-chat).

| Story | Title | Goal | ACs | Tests | Audit | PR | Status |
|---|---|---|---|---|---|---|---|
| [S-1](#s-1-skeleton) | Skeleton | A project that installs, lints, type-checks, tests and builds with no secrets | 2 | 4 | 4 rounds; last [FAIL, manual only](checks/2026-11-26-check-2.md); AC-1.1 signed off | [#1](https://github.com/ayamahmoud-141020/lienguard/pull/1) | merged |
| [S-2](#s-2-domain-basics) | Domain basics | Money in cents, ISO dates and name normalising in one place | 5 | 7 | 4 rounds; all ACs valid | [#1](https://github.com/ayamahmoud-141020/lienguard/pull/1) | merged |
| [S-3](#s-3-spreadsheet-ingest) | Spreadsheet ingest | Read the two spreadsheets into typed rows, with errors per row | 4 | 4 | 4 rounds; all ACs valid | [#1](https://github.com/ayamahmoud-141020/lienguard/pull/1) | merged |
| [S-4](#s-4-sample-data) | Sample data | A fictional batch with known right answers | 4 | 4 | 4 rounds; all ACs valid | [#1](https://github.com/ayamahmoud-141020/lienguard/pull/1) | merged |
| [S-5](#s-5-extraction) | Extraction | AI reads each PDF into a checked schema; unsure reads go to review | 6 | 13 | 4 rounds; all ACs valid | [#1](https://github.com/ayamahmoud-141020/lienguard/pull/1) | merged |
| [S-6](#s-6-matching) | Matching | Tie each document to the right subcontractor, project and payment | 5 | 6 | 4 rounds; all ACs valid | [#1](https://github.com/ayamahmoud-141020/lienguard/pull/1) | merged |
| [S-7](#s-7-rules-exposure-decision) | Rules, exposure, decision | SAFE or HOLD per payment, with rule ids and dollars exposed | 14 | 14 | 4 rounds; all ACs valid | [#1](https://github.com/ayamahmoud-141020/lienguard/pull/1) | merged |
| [S-8](#s-8-pipeline-and-e2e) | Pipeline + E2E | The whole pipeline reproduces the sample's expected results | 3 | 3 | 4 rounds; all ACs valid | [#1](https://github.com/ayamahmoud-141020/lienguard/pull/1) | merged |
| [S-9](#s-9-db-api-and-screens) | DB, API, screens | Store batches and show the dashboard and payment detail | 4 | 8 | 4 rounds; all ACs valid | [#1](https://github.com/ayamahmoud-141020/lienguard/pull/1) | merged |
| [S-10](#s-10-email-drafts-and-sending) | Email drafts and send | Follow-up emails with code-filled numbers, approved before sending | 9 | 9 | 4 rounds; all ACs valid | [#1](https://github.com/ayamahmoud-141020/lienguard/pull/1) | merged |
| [S-11](#s-11-security-health-deploy) | Security, health, deploy | Passcode, upload checks, a health route, the README | 4 | 3 | 4 rounds; last [FAIL, manual only](checks/2026-11-26-check-2.md); AC-11.4 signed off | [#1](https://github.com/ayamahmoud-141020/lienguard/pull/1) | merged |
| [S-12](#s-12-gemini-provider) | Gemini provider | A second AI provider behind the same interfaces | 7 | 8 | 2 rounds; last [FAIL, manual only](checks/2026-11-26-check-2.md); AC-12.7 signed off | [#1](https://github.com/ayamahmoud-141020/lienguard/pull/1) | merged |
| [S-13](#s-13-deterministic-sample-no-stuck-batches) | Deterministic sample, no stuck batches | Same sample result every time; no batch stays "processing" | 4 | 5 | 3 rounds; all ACs valid | [#1](https://github.com/ayamahmoud-141020/lienguard/pull/1) | merged |
| [S-14](#s-14-open-sample-data) | Open sample data | Try the sample with no passcode; keep it for uploads and sending | 3 | 5 | 3 rounds; last [FAIL, manual only](checks/2026-11-26-check-5.md); AC-14.3 signed off | [#1](https://github.com/ayamahmoud-141020/lienguard/pull/1) | merged |
| [S-15](#s-15-frontend-redesign) | Frontend redesign | A new look with no change to rules or decisions | 2 | 0 | 3 rounds; last [FAIL, manual only](checks/2026-11-26-check-5.md); AC-15.1 and AC-15.2 signed off | [#1](https://github.com/ayamahmoud-141020/lienguard/pull/1) | merged |
| [S-16](#s-16-honest-sample-note-ai-quota-message) | Honest sample note; AI-quota message | Say the sample uses recorded readings; say clearly when AI quota runs out | 3 | 5 | 2 rounds; all ACs valid | [#1](https://github.com/ayamahmoud-141020/lienguard/pull/1) | merged |
| [S-17](#s-17-ui-on-shadcnui-dashboard-01) | UI on shadcn/ui dashboard-01 | Rebuild the UI on an MIT template | 4 | 4 | 1 round; [FAIL, manual only](checks/2026-11-26-check-6.md); AC-17.1, 17.2, 17.4 signed off | [#2](https://github.com/ayamahmoud-141020/lienguard/pull/2) | merged |
| [S-18](#s-18-inbound-documents) | Inbound documents | Documents can arrive by an endpoint and re-run the rules | 4 | 7 | 2 rounds; all ACs valid | [#3](https://github.com/ayamahmoud-141020/lienguard/pull/3) | merged |
| [S-19](#s-19-daily-automation) | Daily automation | A daily job re-checks batches, drafts reminders and sends a digest | 4 | 7 | 2 rounds; all ACs valid | [#3](https://github.com/ayamahmoud-141020/lienguard/pull/3) | merged |
| [S-20](#s-20-activity-timeline-loop-in-docs) | Activity timeline; loop in docs | Show every automatic event on the batch page | 2 | 1 | 2 rounds; last [FAIL, manual only](checks/2026-11-26-check-8.md); AC-20.2 signed off | [#3](https://github.com/ayamahmoud-141020/lienguard/pull/3) | merged |
| [S-21](#s-21-sample-emails-ready-at-once) | Sample emails ready at once | Sample batches open with their emails drafted, at no AI cost | 4 | 6 | 1 round; [PASS](checks/2026-11-26-check-9.md) | [#5](https://github.com/ayamahmoud-141020/lienguard/pull/5) | merged |
| [S-22](#s-22-system-flows-data-and-drift-tests) | System flows: data and drift tests | One typed file of system flows, tested against the repo | 4 | 9 | 2 rounds; all ACs valid | [#7](https://github.com/ayamahmoud-141020/lienguard/pull/7) | merged |
| [S-23](#s-23-system-flows-page) | System flows page | Play the flows step by step at `/flows` | 7 | 12 | 2 rounds; last [FAIL, manual only](checks/2026-11-27-check-2.md); AC-23.7 signed off | [#7](https://github.com/ayamahmoud-141020/lienguard/pull/7) | merged |
| [S-24](#s-24-ai-values-must-appear-in-the-pdfs-own-text) | AI values must appear in the PDF's own text | Code catches an AI value that the PDF does not contain | 8 | 13 | 1 round; [FAIL, amended AC](checks/2026-11-27-check-3.md); AC-24.6 signed off | [#8](https://github.com/ayamahmoud-141020/lienguard/pull/8) (open) | awaiting-merge |
| [S-25](#s-25-project-documentation) | Project documentation | These pages, tested against the repo | 5 | 5 | 1 round; [FAIL, manual only](checks/2026-11-27-check-4.md); AC-25.5 needs Aya's review | this PR | checking |
| **Total** | | | **121** | **162** | | | |

---

## S-1 Skeleton
- **Asked:** a project that works from a fresh clone with no secrets.
- **Built:** Next.js, Prisma 6, Tailwind, Vitest, CI and a Zod env schema ([`src/env.ts`](../src/env.ts)). Commit [9b8bc0b](https://github.com/ayamahmoud-141020/lienguard/commit/9b8bc0b).
- **Key ACs:** AC-1.1 lint, typecheck, test and build all pass. AC-1.2 a missing key names the variable and never its value.
- **Changed:** the build is checked by CI, not by a test; Aya signed this off. The first CI run found that `pnpm test:unit` and `pnpm test:e2e` matched no files ([f8c6f6e](https://github.com/ayamahmoud-141020/lienguard/commit/f8c6f6e)).

## S-2 Domain basics
- **Asked:** money as integer cents, business dates as ISO strings, and name normalising, each in one place.
- **Built:** [`src/domain/money.ts`](../src/domain/money.ts), [`src/domain/dates.ts`](../src/domain/dates.ts) and the name normaliser used by matching. Commit [e31189b](https://github.com/ayamahmoud-141020/lienguard/commit/e31189b).
- **Key ACs:** AC-2.1 `parseMoney("$18,000.00")` is 1800000 cents, and bad text is an error, not 0. AC-2.3 four date formats all give `2026-10-31`.

## S-3 Spreadsheet ingest
- **Asked:** read `payments.xlsx` and `subcontractors.xlsx` into typed rows, keeping good rows and reporting bad ones.
- **Built:** [`src/ingest/spreadsheets.ts`](../src/ingest/spreadsheets.ts). Commit [2b52b14](https://github.com/ayamahmoud-141020/lienguard/commit/2b52b14).
- **Key ACs:** AC-3.2 a row with amount "abc" gives an error naming sheet, row and column, and the other rows are kept.

## S-4 Sample data
- **Asked:** a fictional batch with known answers, to test against.
- **Built:** [`scripts/generate-samples.ts`](../scripts/generate-samples.ts) writes 2 spreadsheets, 17 PDFs, one recorded reading per PDF, and [`samples/expected.json`](../samples/expected.json). Commit [5ebfb22](https://github.com/ayamahmoud-141020/lienguard/commit/5ebfb22).
- **Key ACs:** AC-4.1 the PDFs are byte-identical on every run. AC-4.3 the injection PDF contains "Ignore previous instructions", and its recorded reading keeps the real values. AC-4.4 the blurry scan's amount has confidence below 0.7.

## S-5 Extraction
- **Asked:** an AI reader behind an interface, with every field carrying a confidence and the words read.
- **Built:** the schema ([`src/ai/schemas.ts`](../src/ai/schemas.ts)), [`src/ai/to-document.ts`](../src/ai/to-document.ts), the Anthropic and fixture extractors, and a cache keyed by file hash ([`src/ai/cache.ts`](../src/ai/cache.ts)). Commit [00a99d8](https://github.com/ayamahmoud-141020/lienguard/commit/00a99d8).
- **Key ACs:** AC-5.2 a field below 0.7 confidence, a missing field or an unparseable amount means needs review. AC-5.4 the same bytes are read once. AC-5.6 bad output gets one retry, then needs review.

## S-6 Matching
- **Asked:** match each waiver to a subcontractor, project and payment, and each COI to a subcontractor.
- **Built:** [`src/domain/matching/match.ts`](../src/domain/matching/match.ts). Commit [6401b18](https://github.com/ayamahmoud-141020/lienguard/commit/6401b18).
- **Key ACs:** AC-6.2 "Brightway Electric Inc" matches Brightway, not Brightline. AC-6.4 a document that matches nobody goes to review and is never dropped.

## S-7 Rules, exposure, decision
- **Asked:** rules R01–R07, R09 and R12 as pure functions, with `today` passed in.
- **Built:** [`src/domain/rules/index.ts`](../src/domain/rules/index.ts) and [`config/states.json`](../config/states.json). Commit [f50f821](https://github.com/ayamahmoud-141020/lienguard/commit/f50f821).
- **Key ACs:** one AC per rule (AC-7.1 to AC-7.9). AC-7.12 a payment's exposure is its largest finding, not the sum. AC-7.14 no clock calls in `src/domain/`.
- **Changed:** R08, R10, R11 and R13 were left out of the MVP (spec §3, "Out of scope").

## S-8 Pipeline and E2E
- **Asked:** run the whole pipeline on the samples and get `samples/expected.json` exactly.
- **Built:** [`src/pipeline/run-batch.ts`](../src/pipeline/run-batch.ts), [`src/pipeline/evaluate.ts`](../src/pipeline/evaluate.ts) and [`tests/e2e/samples.test.ts`](../tests/e2e/samples.test.ts). Commit [5c56fbd](https://github.com/ayamahmoud-141020/lienguard/commit/5c56fbd).
- **Key ACs:** AC-8.1 the result matches `samples/expected.json` exactly. AC-8.3 the prompt-injection waiver stays an R03 HOLD for $14,000.

## S-9 DB, API and screens
- **Asked:** store batches and documents, and show processing, the dashboard and the payment detail.
- **Built:** [`prisma/schema.prisma`](../prisma/schema.prisma), the API routes under [`src/app/api/`](../src/app/api/) and the pages. Commit [3b4c977](https://github.com/ayamahmoud-141020/lienguard/commit/3b4c977).
- **Key ACs:** AC-9.2 one extract request per PDF, at most 4 at a time. AC-9.4 the payment page has one PASS or HOLD line per rule.
- **Changed:** AC-9.1 was amended when sample data became open to everyone (R-17).

## S-10 Email drafts and sending
- **Asked:** one draft per subcontractor on hold; numbers filled in by code; nothing sent without approval.
- **Built:** [`src/email/workflow.ts`](../src/email/workflow.ts), [`src/email/postcheck.ts`](../src/email/postcheck.ts) and [`src/email/sender.ts`](../src/email/sender.ts). Commit [9c343f5](https://github.com/ayamahmoud-141020/lienguard/commit/9c343f5).
- **Key ACs:** AC-10.2 the model sees only placeholders such as `{{AMOUNT_1}}`. AC-10.3 the post-check rejects an amount or date that isn't in the data. AC-10.6 only approved drafts are sent, once.

## S-11 Security, health, deploy
- **Asked:** a passcode on writes, safe uploads, a health route and a README.
- **Built:** [`src/server/access.ts`](../src/server/access.ts), [`src/server/uploads.ts`](../src/server/uploads.ts) and [`src/server/health.ts`](../src/server/health.ts). Commit [a234326](https://github.com/ayamahmoud-141020/lienguard/commit/a234326).
- **Key ACs:** AC-11.2 a file that isn't a real PDF or xlsx, or is over 4 MB, is refused and not stored. AC-11.3 `/api/health` returns true/false values only, never an env value.
- **Changed:** AC-11.1 was amended by R-17 (open sample data). AC-11.4 (README sections) is manual and was signed off.

## S-12 Gemini provider
- **Asked:** Gemini as a second live provider, because the only key available then was a Gemini key ([ADR-0007](decisions/0007-gemini-provider.md)).
- **Built:** the Gemini extractor and email writer behind the same interfaces, with retries and a concurrency limit. Commit [6e64cda](https://github.com/ayamahmoud-141020/lienguard/commit/6e64cda).
- **Key ACs:** AC-12.3 bad output gets one retry, then needs review. AC-12.4 429, 503 and network drops are retried with backoff, with at most `GEMINI_MAX_CONCURRENCY` requests at once.
- **Changed:** the audit found the limit was per request, not per server; fixed in [98f91d4](https://github.com/ayamahmoud-141020/lienguard/commit/98f91d4). The smoke script was later renamed `pnpm smoke:ai` (AC-12.7 notes it).

## S-13 Deterministic sample, no stuck batches
- **Asked (R-16):** the same sample data gives the same result every time, and no batch stays "processing".
- **Built:** sample batches use the recorded readings; batches finish when viewed or after 3 idle minutes; errors show on the page. Commit [a81d326](https://github.com/ayamahmoud-141020/lienguard/commit/a81d326) (shared with S-14).
- **Key ACs:** AC-13.1 the sample equals `samples/expected.json` whatever AI is configured. AC-13.3 a processing batch is finished when nothing is queued or after 3 minutes idle.

## S-14 Open sample data
- **Asked (R-17):** reviewers can try the sample without a passcode. Uploads, edits and sending stay protected.
- **Built:** the open and protected route lists in [`src/server/access.ts`](../src/server/access.ts). Only the newest 20 sample batches are kept. Commit [a81d326](https://github.com/ayamahmoud-141020/lienguard/commit/a81d326).
- **Key ACs:** AC-14.1 every POST route is in exactly one list. AC-14.2 the 21st sample batch deletes the oldest; uploads are never deleted.

## S-15 Frontend redesign
- **Asked:** a new look, with no change to rules, matching or decisions.
- **Built:** a new app shell and screens. Commit [76b3290](https://github.com/ayamahmoud-141020/lienguard/commit/76b3290).
- **Key ACs:** AC-15.1 (manual, screenshots) and AC-15.2 (all tests stay green, build checked by CI). Both signed off.
- **Changed:** the design was replaced the same day by a template (S-17, R-19).

## S-16 Honest sample note; AI-quota message
- **Asked (R-18):** say where the sample's readings come from; say clearly when the free AI quota runs out.
- **Built:** one shared sentence in [`src/view/copy.ts`](../src/view/copy.ts), and a `quota` code on failed reads. Commit [bdfa116](https://github.com/ayamahmoud-141020/lienguard/commit/bdfa116).
- **Key ACs:** AC-16.2 a 429 after backoff sends the document to review, never a silent pass.
- **Changed:** AC-16.1 was amended by R-21 to name the Claude run as well.

## S-17 UI on shadcn/ui dashboard-01
- **Asked (R-19):** base the UI on a permissively licensed template.
- **Built:** shadcn/ui `dashboard-01` (MIT), recorded in [ADR-0008](decisions/0008-ui-template.md). Chart data come from [`src/view/charts.ts`](../src/view/charts.ts). Commit [6d3d45e](https://github.com/ayamahmoud-141020/lienguard/commit/6d3d45e).
- **Key ACs:** AC-17.3 chart data are a pure function and match `samples/expected.json`. AC-17.1, 17.2 and 17.4 were signed off.

## S-18 Inbound documents
- **Asked (R-20):** documents arrive by an endpoint and re-run the rules on their own.
- **Built:** `/api/inbound` with its own secret, and `receiveDocument` in [`src/automation/engine.ts`](../src/automation/engine.ts). Commit [296a7b8](https://github.com/ayamahmoud-141020/lienguard/commit/296a7b8) (shared with S-19).
- **Key ACs:** AC-18.1 a wrong secret gets 401 and stores nothing. AC-18.3 the corrected sample waiver flips PAY-02 from HOLD to SAFE and notifies the AP inbox.

## S-19 Daily automation
- **Asked (R-20):** a daily job re-checks open batches, drafts reminders and sends a digest.
- **Built:** `dailyCheck` in [`src/automation/engine.ts`](../src/automation/engine.ts), [`src/automation/reminders.ts`](../src/automation/reminders.ts), [`src/automation/digest.ts`](../src/automation/digest.ts) and the cron in [`vercel.json`](../vercel.json). Commit [296a7b8](https://github.com/ayamahmoud-141020/lienguard/commit/296a7b8).
- **Key ACs:** AC-19.2 an expired COI becomes R09 HOLD. AC-19.3 reminders are drafts that need approval. AC-19.4 the digest's numbers are checked before sending.

## S-20 Activity timeline; loop in docs
- **Asked (R-20):** every automatic event shows on the batch page.
- **Built:** [`src/view/activity.ts`](../src/view/activity.ts) and the timeline on the batch page. Commit [f44da8d](https://github.com/ayamahmoud-141020/lienguard/commit/f44da8d).
- **Key ACs:** AC-20.1 the sentence and source of each event come from a tested function. AC-20.2 (manual) was signed off.

## S-21 Sample emails ready at once
- **Asked (R-21):** sample batches open with their emails drafted, with no AI calls per click.
- **Built:** [`src/email/recorded-writer.ts`](../src/email/recorded-writer.ts) replays wording recorded from live runs in [`samples/drafts/`](../samples/drafts/); code still fills and checks it. Commit [f244d74](https://github.com/ayamahmoud-141020/lienguard/commit/f244d74).
- **Key ACs:** AC-21.1 six drafts, zero AI calls. AC-21.2 a recording is used only for the exact input it was made for.

## S-22 System flows: data and drift tests
- **Asked (R-22):** the data for a "system flows" page, which can't drift from the code.
- **Built:** [`src/flows/flows.ts`](../src/flows/flows.ts) and [`tests/unit/flows.test.ts`](../tests/unit/flows.test.ts). Commit [5b9d6b2](https://github.com/ayamahmoud-141020/lienguard/commit/5b9d6b2).
- **Key ACs:** AC-22.2 every file and function named exists. AC-22.4 stated outcomes are checked against a real run.
- **Changed:** the request listed rules "R01–R12"; the code has R01–R07, R09 and R12, so the page shows those. The request also had a "value doesn't match" step that the code did not have then (S-24 added one).

## S-23 System flows page
- **Asked (R-22):** an interactive page at `/flows`.
- **Built:** [`src/components/app/flows/flow-explorer.tsx`](../src/components/app/flows/flow-explorer.tsx) and a pure player, [`src/flows/player.ts`](../src/flows/player.ts). Commit [3f4f67b](https://github.com/ayamahmoud-141020/lienguard/commit/3f4f67b).
- **Key ACs:** AC-23.2 keyboard controls. AC-23.5 reduced motion is respected. AC-23.7 (manual layout) was signed off.

## S-24 AI values must appear in the PDF's own text
- **Asked (R-23):** close the prompt-injection gap: every value the AI returns must appear in the PDF's text, or the document goes to review.
- **Built:** [`src/ai/grounding.ts`](../src/ai/grounding.ts), [`src/ai/pdf-text.ts`](../src/ai/pdf-text.ts) and [`src/ai/grounded-extractor.ts`](../src/ai/grounded-extractor.ts). Commit [a0ffc50](https://github.com/ayamahmoud-141020/lienguard/commit/a0ffc50).
- **Key ACs:** AC-24.5 a fake model that obeys the injection still leaves PAY-12 on HOLD. AC-24.4 sentences addressed to AI don't count as the document's text.
- **Changed:** the plain rule would have let the sample injection through, because the injected line itself contains "$1,000,000.00". So sentences addressed to AI are left out. AC-24.6 was amended because the check also caught the blurry scan's guessed amount; Aya signed this off.

## S-25 Project documentation
- **Asked (R-24):** full documentation written from the repo, with every claim linked.
- **Built:** these pages and [`tests/unit/docs.test.ts`](../tests/unit/docs.test.ts).
- **Key ACs:** AC-25.2 every linked or named file exists. AC-25.4 the numbers on this page match the repo. AC-25.5 (manual) Aya reviews the text.
