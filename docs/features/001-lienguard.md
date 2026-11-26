# Feature 001: LienGuard MVP (safe-to-pay check)

**Status:** agreed. Gate A passed: Aya, 2026-11-25 ("agreed, 1a, yes, yes, public").
**Request:** `docs/requests/001-lienguard.md` · **Plan:** `PLAN.md` Part A · **ADRs:** 0001–0006

## 1. Goal
For a batch of subcontractor payments, decide per payment **SAFE** or **HOLD** with rule ids and plain-English reasons. Do it from the payments spreadsheet and the waiver/COI PDFs that arrived. Show the dollars exposed. Draft one follow-up email per subcontractor with issues; a person approves it before it is sent.

## 2. Users
| User | Success looks like |
|---|---|
| AR/AP specialist | Clears a 12-payment batch in minutes; knows exactly what to chase |
| Project manager / controller | One number: exposed $ for the batch |
| Subcontractor (email recipient) | One clear email with a numbered list of what to send |

## 3. Scope
**In scope:**
- Sample-data batch (one click) and processing of uploaded PDFs, one per request.
- AI extraction with confidence → `needsReview`.
- Matching of documents to subs, projects and payments.
- Rules R01–R07, R09, R12; exposure; decision.
- Dashboard and payment detail.
- Email drafts with placeholders and a post-check; approve, edit, skip; send via Resend with demo override; audit log.
- Passcode, upload checks, health route, deploy, README.

**Out of scope (README "Next steps", PLAN.md Part B):**
- Lower tiers (R08), R10 COI limits, R11 COI expiring soon, R13 exceptions.
- Review/edit-documents screen.
- Excel export, extraction eval script, AI cost footer, Playwright.

## 4. Requirements
- **R-1** Read payments (sheet `Payments`), projects (sheet `Projects`) from `payments.xlsx` and subs from `subcontractors.xlsx` into typed rows. Bad rows are reported per row and column; good rows are kept.
- **R-2** Money is integer cents and business dates are ISO `YYYY-MM-DD`, parsed only by domain code.
- **R-3** Each PDF is classified (waiver / coi / unknown) and its fields extracted by an `Extractor`. Every field carries `value`, `confidence` and `sourceText`.
- **R-4** A document is `needsReview` when any required field is null, has confidence < 0.7, or fails to parse; when output is invalid after one retry; when the model refuses; or when it can't be matched.
- **R-5** An extraction is cached by the SHA-256 of the file bytes; the same bytes never cause a second model call.
- **R-6** Waivers are matched to a sub, a project and a payment, and COIs to a sub, by normalized names and dates.
- **R-7** Rules R01–R07, R09, R12 run as pure functions with `today` injected, using `config/states.json`.
- **R-8** SAFE = no `hold` findings. Payment exposure = the max finding exposure; batch exposure = the sum. Unpaid payments have $0 exposure.
- **R-9** The pipeline on `samples/` with the fixture extractor reproduces `samples/expected.json` exactly.
- **R-10** Text inside documents never changes behaviour (prompt-injection safe).
- **R-11** UI: sample-data button, processing list, dashboard, payment detail.
- **R-12** One email draft per sub with at least one HOLD. The model only sees placeholders, and code fills in numbers. A post-check rejects unknown amounts or dates and missing issues; there is one regeneration, then a code template.
- **R-13** Only human-approved drafts are sent, idempotently, with demo redirect. Every action is audit-logged.
- **R-14** Write actions need `DEMO_PASSCODE`. Uploads accept only real PDFs/XLSX ≤ 4 MB. `/api/health` reports booleans only.
- **R-15** *(added 2026-11-26, agreed by Aya in chat)* Gemini is a third AI provider (`LIENGUARD_AI=gemini`, `GEMINI_API_KEY`, `GEMINI_MODEL`), behind the same `Extractor` and `EmailWriter` interfaces, with the same Zod validation, confidence rules, placeholders and post-check. Anthropic stays as is. Free-tier safe: limited concurrency and backoff on 429.
- **R-16** *(added 2026-11-26, Aya)* Same sample data gives the same result every time, and no batch ever stays `processing`: it ends `ready` or `failed` with a visible error.
- **R-17** *(added 2026-11-26, Aya; amends R-14)* Reviewers can try the sample batch without a passcode. The passcode stays on: uploading own files (and reading them), editing drafts, sending emails.
- **R-18** *(added 2026-11-26, Aya)* Be honest that the sample uses recorded readings, and say so where it is shown. If the free AI quota runs out, uploads say so clearly instead of failing silently.
- **R-19** *(added 2026-11-26, Aya)* The UI is based on a permissively licensed template (shadcn/ui `dashboard-01`, MIT) instead of a custom design. Logic, tests, wording, data and passcode behaviour stay unchanged.
- **R-20** *(added 2026-11-26, Aya)* Close the loop with automation: documents arrive by an inbound endpoint, a daily job re-checks open batches, drafts reminders and sends a digest, and every automatic event shows in an activity timeline. Emails to subcontractors still always need human approval; only notifications and the digest to the AP inbox are sent automatically.

## 5. Acceptance criteria
Shared values: `DEMO_TODAY = 2026-11-20`. Grace days = 5. TX requires notary; CA and AZ don't.

### S-1 Skeleton
- **AC-1.1** [R-2] Given a fresh clone with no secrets, when `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` run, then all succeed.
- **AC-1.2** [R-14] Given `LIENGUARD_AI=anthropic` and no `ANTHROPIC_API_KEY`, when the env is loaded, then it throws an error naming `ANTHROPIC_API_KEY` that contains no other env value. Given `LIENGUARD_AI=fixture`, no key is required.

### S-2 Domain basics
- **AC-2.1** [R-2] `parseMoney("$18,000.00")` = 1800000; `parseMoney("18000")` = 1800000; `parseMoney("$1,234.5")` = 123450; `parseMoney("eighteen")` is an error result (not a throw, not 0).
- **AC-2.2** [R-2] `formatMoney(200000)` = `"$2,000.00"`; `formatMoney(123450)` = `"$1,234.50"`.
- **AC-2.3** [R-2] `parseDate("10/31/2026")`, `parseDate("October 31, 2026")`, `parseDate("2026-10-31")` and `parseDate("Oct. 31, 2026")` all = `"2026-10-31"`; `parseDate("2026-02-30")` and `parseDate("soon")` are error results.
- **AC-2.4** [R-2] `daysBetween("2026-11-06", "2026-11-20")` = 14; `compareDates("2026-09-30", "2026-10-31")` < 0.
- **AC-2.5** [R-6] `normalizeName("Summit Air Mechanical, LLC")` = `"summit air mechanical"`; `normalizeName("Granite Drywall & Paint Inc.")` = `"granite drywall and paint"`; `normalizeName("  BLUELINE  Plumbing Co. ")` = `"blueline plumbing"`.

### S-3 Spreadsheet ingest
- **AC-3.1** [R-1] Given a `Payments` row `PAY-01, RVR, SUM, INV-1001, 20000, 2026-10-31, 2026-11-14, No`, when ingested, then the payment is `{amountCents: 2000000, periodEnd: "2026-10-31", paidDate: "2026-11-14", isFinal: false}`. An empty paid date gives `paidDate: null`.
- **AC-3.2** [R-1] Given 3 rows where row 3 has amount `"abc"`, when ingested, then 2 payments are returned plus 1 error `{sheet: "Payments", row: 3, column: "Amount"}`.
- **AC-3.3** [R-1, R-2] Excel date cells (serial numbers) and text dates (`10/31/2026`) both become `"2026-10-31"`.
- **AC-3.4** [R-1] `Projects` rows give `{code, name, state, ownerName}`, where `state` is a 2-letter code. `subcontractors.xlsx` rows give `{code, name, email, contactName}`. An invalid email is a row error.

### S-4 Sample data
- **AC-4.1** [R-9] `pnpm samples` writes `samples/payments.xlsx`, `samples/subcontractors.xlsx`, 17 PDFs in `samples/pdfs/`, one fixture JSON per PDF, `samples/expected.json` and `samples/EXPECTED.md`. Running it twice produces byte-identical PDFs (the same SHA-256).
- **AC-4.2** [R-9] `expected.json` contains 12 payments. Each of R01, R02, R03, R04, R05, R06, R07, R09 and R12 appears at least once. At least one paid SAFE and one unpaid SAFE ("ready to pay") payment are present. One payment has R02 and R04 together.
- **AC-4.3** [R-10] The injection PDF's text contains "Ignore previous instructions". Its fixture records what the document really says: `conditional`, `$14,000.00`.
- **AC-4.4** [R-4] The blurry PDF's fixture has its `amount` confidence < 0.7.

### S-5 Extraction
- **AC-5.1** [R-3] The `Extraction` Zod schema accepts a valid waiver extraction and a valid COI extraction. It rejects a waiver whose `type` is `"partial"` and one that is missing `claimantName`.
- **AC-5.2** [R-4] `toDocument(extraction)` sets `needsReview` with a reason naming the field, in each of these cases: a required field has confidence 0.5; a required field is null; the amount is `"twenty thousand-ish"`. Otherwise it returns the parsed cents and ISO dates.
- **AC-5.3** [R-3, R-4] `FixtureExtractor` returns the fixture for a sample PDF's SHA-256. For unknown bytes it returns `kind: "unknown"`, which becomes `needsReview`.
- **AC-5.4** [R-5] Given the same bytes twice, `cachedExtract` calls the inner extractor once and returns equal results.
- **AC-5.5** [R-3, R-10] `AnthropicExtractor` sends one request with:
  - a base64 `document` block,
  - `model` taken from `ANTHROPIC_MODEL`,
  - `output_config.effort = "low"`,
  - a structured-output format,
  - a system prompt stating the document is untrusted data.

  This is tested with a fake client; there is no network.
- **AC-5.6** [R-4] If the fake client first returns output that fails Zod and then valid output, the result is valid after exactly 2 calls. If it fails twice, or returns `stop_reason: "refusal"`, the result is `needsReview`.

### S-6 Matching
- **AC-6.1** [R-6] Claimant `"Summit Air Mechanical, L.L.C."` matches sub `"Summit Air Mechanical"` with score 1.0.
- **AC-6.2** [R-6] With subs `"Brightway Electric"` and `"Brightline Electrical Services"`, claimant `"Brightway Electric Inc"` matches only Brightway.
- **AC-6.3** [R-6] With two BlueLine/LKV payments (period ends 2026-09-30 and 2026-10-31), a waiver through 2026-09-30 matches the September payment. For a tie in distance, `isFinal` matching the waiver scope breaks the tie; if it is still tied, the waiver is unmatched.
- **AC-6.4** [R-4, R-6] A waiver whose claimant matches no sub (score < 0.88) is returned as unmatched with reason `"no subcontractor match"`, and the document becomes `needsReview`. It is never silently dropped.
- **AC-6.5** [R-6] A COI with insured `"Copperleaf Roofing LLC"` matches sub Copperleaf Roofing.

### S-7 Rules, exposure, decision
Base case for each AC unless it says otherwise:
- Paid $20,000 on 2026-11-14 for period end 2026-10-31, AZ project, not final.
- An unconditional progress waiver for $20,000 through 2026-10-31, signed, not needing review.
- A COI expiring 2027-06-30.
- **AC-7.1** [R-7] R01: no waiver → HOLD R01, exposure $20,000. If the payment is unpaid → HOLD R01, exposure $0.
- **AC-7.2** [R-7] R02: waiver $18,000 → HOLD R02, exposure $2,000.
- **AC-7.3** [R-7] R03: paid 2026-11-06 (14 days before today), only a conditional waiver → HOLD R03, exposure $20,000. Paid 2026-11-15 (5 days before today), conditional → no R03.
- **AC-7.4** [R-7] R04: waiver through 2026-09-30 → HOLD R04, exposure $20,000.
- **AC-7.5** [R-7] R05: waiver unsigned → HOLD R05, exposure $20,000.
- **AC-7.6** [R-7] R06: TX project, waiver not notarized → HOLD R06, exposure $20,000. The same waiver on an AZ project → no R06.
- **AC-7.7** [R-7] R07: payment final, waiver scope progress → HOLD R07, exposure $20,000.
- **AC-7.8** [R-7] R09: no COI → HOLD R09. COI expired 2026-11-10 and paid 2026-11-15 → HOLD R09. For an unpaid payment the comparison date is today. R09 exposure is $0.
- **AC-7.9** [R-4, R-7] R12: the matched waiver is `needsReview` → HOLD R12, exposure $20,000 (Q1 → a). That waiver is not used by R02–R07.
- **AC-7.10** [R-8] The base case → SAFE, no findings, exposure $0.
- **AC-7.11** [R-8] Unpaid, conditional waiver for the full amount, valid COI → SAFE ("ready to pay").
- **AC-7.12** [R-8] Waiver $18,000 through 2026-09-30 → findings R02 and R04; exposure $20,000 (the max), not $22,000.
- **AC-7.13** [R-8] Batch exposure = the sum of payment exposures. Every finding has `ruleId`, `severity: "hold"` and a plain-English `message` that contains the relevant amounts or dates.
- **AC-7.14** [R-7] `grep "Date.now\|new Date()" src/domain` finds nothing; `today` is a parameter of `runRules`.

### S-8 Pipeline + E2E
- **AC-8.1** [R-9] `runBatch(samples, FixtureExtractor, today = 2026-11-20)` matches `samples/expected.json` exactly: every payment's decision, sorted rule ids and exposure cents, plus the batch exposure.
- **AC-8.2** [R-5, R-9] Running the same batch twice returns an identical result, and the fixture extractor is called once per unique PDF.
- **AC-8.3** [R-10] The injection payment (Summit Air / PRK) is HOLD R03 with exposure $14,000, not SAFE. Its waiver amount is 1400000 cents, not 100000000.

### S-9 Screens
- **AC-9.1** [R-11] `POST /api/batches/sample` creates a batch from `samples/` and returns its id. Calling it again creates a separate batch. Within a batch, the same PDF bytes are stored once (unique `batchId + sha256`).
- **AC-9.2** [R-11] The processing page sends one `POST /api/batches/:id/documents/:docId/extract` per PDF, at most 4 at a time, and shows a status per file (`queued`, `reading`, `done`, `needs review`). Tested via the client queue helper.
- **AC-9.3** [R-11] For the sample batch, the dashboard view-model shows: exposed $ equal to `expected.json`, the SAFE and HOLD counts, and one row per payment (sub, project, invoice, amount, paid date, decision, rule chips, exposed).
- **AC-9.4** [R-11] The payment-detail view-model lists its matched documents and one line per MVP rule with `PASS` or `HOLD` and the message.

### S-10 Email drafts and sending
- **AC-10.1** [R-12] Generating drafts for the sample batch creates exactly one draft per sub with ≥ 1 HOLD and none for subs whose payments are all SAFE. Generating again doesn't duplicate drafts.
- **AC-10.2** [R-12] The `EmailWriter` input contains placeholders (`{{AMOUNT_1}}`, `{{DATE_1}}`), with no digits from amounts or dates. Code fills them in.
- **AC-10.3** [R-12] `postcheck` rejects a body containing `$9,999.00` or `2026-12-01` when neither is in the issues, and accepts a body whose amounts and dates all come from the issues.
- **AC-10.4** [R-12] `postcheck` rejects a body that misses an issue (each rule id has a required phrase, e.g. R06 → "notar").
- **AC-10.5** [R-12] If the writer fails the post-check twice, the draft uses the code template, and that template passes the post-check.
- **AC-10.6** [R-13] Sending a draft that is not `approved` is refused. Sending an approved draft calls the sender once with idempotency key `lienguard-draft/<id>` and sets `sent`. Sending it again doesn't call the sender.
- **AC-10.7** [R-13] With `DEMO_EMAIL_OVERRIDE=demo@example.test`, the email goes to that address with subject prefix `[DEMO → <original address>]`.
- **AC-10.8** [R-12, R-13] Editing a body to add `$5.00` saves the body and returns a post-check warning. The draft is not blocked.
- **AC-10.9** [R-13] A sender error sets status `failed` with the error text, and the draft can be sent again. Approve, edit, skip, send and fail each write one audit-log row (actor, action, draft id).

### S-11 Security, health, deploy
- **AC-11.1** [R-14, amended by R-17 on 2026-11-26] Every passcode-only write route (upload spreadsheets, upload PDF, `extract`, `evaluate`, `edit`, `send`) returns 401 without the correct `x-demo-passcode` header. The open routes are listed in AC-14.1.
- **AC-11.2** [R-14] An upload whose bytes don't start with `%PDF-` (or `PK` for xlsx), or that is larger than 4 MB, returns 400 and is not stored.
- **AC-11.3** [R-14] `GET /api/health` returns `{ ok, db: boolean, env: { [name]: boolean } }` and never any env value (tested by checking that no env value appears in the response).
- **AC-11.4** [R-11] The README has these sections: problem, live link and passcode, where AI is and isn't used, how it was built, run locally, next steps, disclaimer. *(manual check)*

### S-12 Gemini provider
- **AC-12.1** [R-15] `LIENGUARD_AI=gemini` without `GEMINI_API_KEY` throws an error that names `GEMINI_API_KEY` and no value. `GEMINI_MODEL` has a default.
- **AC-12.2** [R-3, R-15] `GeminiExtractor` makes one request per PDF: the bytes inline as base64 with `mimeType: application/pdf`, the configured model, `responseMimeType: application/json` and a `responseJsonSchema` built from the `Extraction` Zod schema. Valid JSON is re-validated with Zod and returned as `ok: true`.
- **AC-12.3** [R-4] Output that isn't JSON or fails the schema gets one retry with feedback, then `ok: false`. An empty or blocked response gives `ok: false` (→ needsReview).
- **AC-12.4** [R-15] A 429, a 503 or a network drop ("fetch failed") is retried with exponential backoff (up to 4 retries); other errors are not retried by backoff. At most `GEMINI_MAX_CONCURRENCY` (default 2) Gemini requests run at once per server instance.
- **AC-12.5** [R-12, R-15] `GeminiEmailWriter` sends only the placeholder input (`forModel`) and returns `{subject, bodyTemplate}` validated by Zod. Its drafts go through the same post-check: a draft with a made-up amount is rejected.
- **AC-12.6** [R-15] With `LIENGUARD_AI=gemini`, the app builds the Gemini extractor and writer. `/api/health` reports `GEMINI_API_KEY` as a boolean.
- **AC-12.7** [R-15] `pnpm smoke:gemini` runs the live extractor on `samples/pdfs` and prints per-field agreement with the fixtures. *(manual, needs a key; never in CI)*

### S-13 Deterministic sample batch, no stuck batches
- **AC-13.1** [R-16] "Use sample data" creates a batch that is `ready` when the request returns. Its readings come from the recorded fixtures, never the live AI, so decisions, rule ids and exposure equal `expected.json` every time, whatever `LIENGUARD_AI` is.
- **AC-13.2** [R-16] An extraction request that throws marks its document `needs_review` with the reason instead of leaving it `queued`.
- **AC-13.3** [R-16] A `processing` batch is finished when it is viewed and either it has documents and none is `queued`, or nothing has happened for 3 minutes (also when it has no documents at all). Unread documents become needs review → HOLD.
- **AC-13.4** [R-16] If evaluation throws, the batch becomes `failed` with an error message that the batch page shows.

### S-14 Open sample data, passcode for the rest
- **AC-14.1** [R-17, extended by R-20] Without the passcode these POST routes work: sample batch, simulate a subcontractor reply, generate drafts, approve, skip. These return 401 without it: upload spreadsheets, upload PDF, extract, evaluate, run daily check, edit draft, send. Every POST route is in exactly one of the two lists, except `/api/inbound`, which uses its own secret (AC-18.1).
- **AC-14.2** [R-17] Only the newest 20 sample batches are kept. Creating one more deletes the oldest sample batch; uploaded batches are never deleted.
- **AC-14.3** [R-17] In the UI, passcode-only actions show "Demo passcode required — ask Aya" while locked. *(manual)*

### S-15 Frontend redesign (no change to rules, matching or decisions)
- **AC-15.1** App shell with sidebar, top bar and a "Demo access" popover (locked/unlocked). Home, batch dashboard, payment detail, email review, audit log and processing screens follow the brief from 2026-11-26. *(manual: Playwright screenshots in `docs/screenshots/`)*
- **AC-15.2** All existing tests stay green; lint, typecheck and build pass (build verified by CI). Money and counts use tabular numbers. *(build: CI; tabular numbers: manual)*

### S-16 Honest sample note; clear AI-quota message
- **AC-16.1** [R-18] The sample batch page and the README show the same note: hand-checked readings, a live Gemini run matched 105 of 106 fields, upload your own PDFs for live extraction. Both use one shared sentence.
- **AC-16.2** [R-18] When the AI provider returns 429 after backoff, the reading is `ok: false` with `code: "quota"`, and the document goes to needs review (HOLD, never a silent pass).
- **AC-16.3** [R-18] The extract response then carries the notice "AI quota reached, try later". The processing screen shows it, and so does the dashboard of a batch with any quota-failed document.

### S-17 UI on the shadcn/ui dashboard-01 template
- **AC-17.1** [R-19] App shell (sidebar + header) and the batch dashboard use the template's components: KPI cards, a "Holds by reason" chart, a Safe vs Hold chart, and its data-table pattern with filters, search, sticky header and row hover. Content width up to about 1440px, base font 15px, status colours only for status. *(manual: screenshots at 1440px and 1280px)*
- **AC-17.2** [R-19] Emails are master–detail: subcontractor list on the left, the rendered email on the right, with code-filled amounts and dates highlighted. "Edit" switches to the textarea. *(manual)*
- **AC-17.3** [R-19] The chart data come from a pure function of the batch result: holds per rule id and the SAFE/HOLD counts, which match `expected.json` for the sample. The preview highlights exactly the amounts and dates that code filled in.
- **AC-17.4** [R-19] All existing tests stay green, and lint, typecheck and build pass. Passcode behaviour is unchanged (AC-14.1 tests). The template's licence is recorded in `docs/decisions/0008-ui-template.md`.

### S-18 Inbound documents
- **AC-18.1** [R-20] `POST /api/inbound` needs the `x-inbound-secret` header equal to `INBOUND_SECRET`; otherwise it returns 401 and stores nothing. It accepts a batch id and one PDF (same upload checks as AC-11.2).
- **AC-18.2** [R-20] Receiving a document stores it (dated with the batch's day), reads it (recorded reading if one exists, otherwise the live extractor), re-runs matching and rules, and records what changed: one activity event per payment whose decision changed.
- **AC-18.3** [R-20] When a payment flips HOLD → SAFE, a notification "<Sub> is now safe to pay: <invoice>, <amount>" goes to the AP inbox (idempotent per batch, payment and flip). The sample corrected waiver flips PAY-02 (BlueLine, BLP-2201, $20,000.00) from HOLD to SAFE.
- **AC-18.4** [R-20] "Simulate a subcontractor reply" on a sample batch receives the corrected waiver through the same code path without a passcode. The AP email is sent only when demo access is unlocked; otherwise the timeline records it as not sent.

### S-19 Daily automation
- **AC-19.1** [R-20] `GET /api/cron/daily` needs `Authorization: Bearer <CRON_SECRET>` (Vercel Cron); otherwise 401. It runs the daily check for every ready batch with the real date as `today` (never moving a batch's date backwards). "Run daily check now" (passcode) runs it for one batch, moving its demo date forward one day.
- **AC-19.2** [R-20] The daily check re-runs the rules with the new `today`: a COI that has expired becomes R09 HOLD, and a conditional waiver past the grace period becomes R03 HOLD. Decision changes are recorded as activity events.
- **AC-19.3** [R-20] For each subcontractor whose follow-up email was sent at least 3 days earlier (batch days) and who sent no new document since, one reminder draft is created (status `draft`, needs approval, never sent automatically). It passes the email post-check.
- **AC-19.4** [R-20] One digest email per run goes to the AP inbox: new holds, cleared holds, exposed $ and drafts waiting for approval. Its numbers are built from the data and checked against it before sending (a post-check).

### S-20 Activity timeline and the automated loop in docs
- **AC-20.1** [R-20] The batch page shows an activity timeline: document received, rules re-run, status changed, reminder drafted, notification and digest sent, with time and source ("Automation" or the person's name).
- **AC-20.2** [R-20] README and the home "How it works" strip show the automated loop: document arrives → AI reads → rules re-check → status changes → notify or draft reminder → human approves. *(manual)*

## 6. Data
- `Batch(id, name, createdAt, status)`
- `Project(code, name, state, ownerName)`
- `Subcontractor(code, name, email, contactName)`
- `Payment(id, projectCode, subCode, invoiceNo, amountCents:int, periodEnd:ISO, paidDate:ISO|null, isFinal)`
- `Document(id, batchId, fileName, sha256, bytes, kind, extractionJson, needsReview, reviewReasons[])`, unique `(batchId, sha256)`
- `ExtractionCache(sha256 PK, json)`
- `Waiver(documentId, claimant, customer, project, type, scope, amountCents, throughDate, signed, notarized, matchedSub/Project/Payment, score)`
- `Coi(documentId, insured, glExpiry, matchedSub)`
- `Finding(paymentId, ruleId, severity, message, exposedCents)`
- `EmailDraft(id, batchId, subCode, to, subject, body, status, approvedBy/At, sentAt, providerMessageId, error)`
- `AuditLog(at, actor, action, entityType, entityId, details)`

## 7. Risks
| Risk | Mitigation |
|---|---|
| Extraction errors on real PDFs | Confidence threshold → `needsReview` → HOLD (fail safe) |
| State rules differ | `config/states.json` demo defaults; disclaimer |
| LLM invents numbers in emails | Placeholders + post-check + code template |
| Prompt injection in a PDF | Data-only system prompt, schema-bound output, test AC-8.3 |
| Vercel 4.5 MB / 300 s | One PDF per request, 4 MB cap |
| Time (ship tomorrow) | Cut order in PLAN.md §A.7 |

## 8. Open questions: answered at Gate A (2026-11-25)
- **Q1 → (a)** R12 exposure = full paid amount.
- **Q2 → yes** R09 exposure = $0.
- **Q3 → yes** conditional within grace = SAFE, no finding.
- **Q4 → public** repo `ayamahmoud-141020/lienguard`.

Original questions:
- **Q1, R12 exposure.** When the matched waiver can't be read reliably, what is the payment's exposure?
  - (a) **The full paid amount** *(recommended: we can't prove any coverage, so fail safe)*
  - (b) $0, shown as "unquantified"
- **Q2, R09 exposure.** An expired or missing COI holds the payment, but it isn't a lien exposure. Proposed: **$0**, shown as a HOLD reason only.
- **Q3, conditional waiver within the grace period.** Paid ≤ 5 days ago with only a conditional waiver. Proposed: **SAFE, no finding** (there are no warn rules in the MVP).

## 9. Stories
_File lists updated 2026-11-25 after the first check report to match where the code actually lives (no scope change). S-15's list was widened on 2026-11-26 after check report 3 to declare `rule-labels.ts`, `screenshots.ts` and one read-only helper._

| Story | Title | ACs | Depends on | Likely files |
|---|---|---|---|---|
| S-1 | Skeleton: Next.js, Prisma 6, Tailwind, Vitest, CI, env schema | AC-1.1–1.2 | — | `package.json`, `src/env.ts`, `prisma/schema.prisma` |
| S-2 | Domain: money, dates, name normalization | AC-2.1–2.5 | S-1 | `src/domain/{money,dates,types}.ts`, `src/domain/matching/normalize.ts` |
| S-3 | Spreadsheet ingest with Zod | AC-3.1–3.4 | S-2 | `src/ingest/spreadsheets.ts` |
| S-4 | Sample generator, fixtures, expected.json | AC-4.1–4.4 | S-2 | `scripts/{generate-samples,sample-scenarios}.ts`, `samples/**` |
| S-5 | Extraction: schemas, toDocument, fixture/Anthropic extractors, cache | AC-5.1–5.6 | S-2 | `src/ai/*` |
| S-6 | Matching | AC-6.1–6.5 | S-2, S-5 | `src/domain/matching/match.ts` |
| S-7 | Rules, exposure, decision | AC-7.1–7.14 | S-6 | `src/domain/rules/*`, `src/domain/{exposure,decision}.ts`, `config/states.json` |
| S-8 | Batch pipeline + E2E on samples | AC-8.1–8.3 | S-3, S-4, S-7 | `src/pipeline/{run-batch,evaluate,samples}.ts`, `tests/e2e/samples.test.ts` |
| S-9 | DB, API and screens: sample batch, processing, dashboard, detail | AC-9.1–9.4 | S-8 | `src/db/*`, `src/server/{batches,guard,uploads,audit}.ts`, `src/view/models.ts`, `src/lib/queue.ts`, `src/pipeline/documents.ts`, `prisma/migrations/**`, `src/app/**` |
| S-10 | Email writer, post-check, drafts, Resend send, audit | AC-10.1–10.9 | S-7, S-9 | `src/email/*` (writer, postcheck, issues, sender, workflow), `src/server/drafts.ts`, `src/app/**/drafts`, `src/app/**/audit` |
| S-11 | Passcode, upload checks, health, deploy, README | AC-11.1–11.4 | S-9, S-10 | `src/server/{guard,uploads,health}.ts`, `src/app/api/health`, `README.md` |
| S-12 | Gemini provider (extractor, writer, backoff, smoke script) | AC-12.1–12.7 | S-5, S-10 | `src/ai/gemini*.ts`, `src/email/gemini-writer.ts`, `src/env.ts`, `src/server/{batches,drafts,health}.ts`, `scripts/smoke-gemini.ts`, `docs/decisions/0007-*.md`, `package.json` |
| S-13 | Deterministic sample batch; no stuck batches | AC-13.1–13.4 | S-9, S-12 | `src/server/batches.ts`, `src/pipeline/lifecycle.ts`, `src/app/api/batches/**`, `prisma/**` |
| S-14 | Open sample data; passcode for uploads, edit and send | AC-14.1–14.3 | S-11, S-13 | `src/server/{guard,access}.ts`, `src/app/api/**`, `tests/unit/security.test.ts` |
| S-15 | Frontend redesign | AC-15.1–15.2 | S-13, S-14 | `src/app/**`, `src/components/**`, `src/view/rule-labels.ts`, `src/server/batches.ts` (read-only `getDocumentReadings` for the payment page), `scripts/screenshots.ts`, `docs/screenshots/**`, `package.json` |
| S-16 | Honest sample note; AI-quota message | AC-16.1–16.3 | S-12, S-15 | `src/view/copy.ts`, `src/ai/{extractor,gemini-extractor}.ts`, `src/server/batches.ts`, `src/app/api/batches/[id]/documents/[docId]/extract/route.ts`, `src/app/_components/processing.tsx`, `src/app/batches/[id]/page.tsx`, `README.md` |
| S-17 | UI on shadcn/ui dashboard-01 | AC-17.1–17.4 | S-15, S-16 | `src/components/**`, `src/app/**`, `src/lib/utils.ts`, `src/hooks/**`, `src/view/{charts,highlight}.ts`, `components.json`, `package.json`, `scripts/screenshots.ts`, `docs/screenshots/**`, `docs/decisions/0008-ui-template.md` |
| S-18 | Inbound documents | AC-18.1–18.4 | S-13, S-17 | `src/automation/**`, `src/server/automation.ts`, `src/app/api/inbound/**`, `src/app/api/batches/[id]/simulate-reply/**`, `scripts/{generate-samples,sample-scenarios}.ts`, `samples/inbound/**`, `src/pipeline/samples.ts`, `src/ai/fixture-extractor.ts`, `prisma/**`, `src/env.ts`, `src/server/access.ts` |
| S-19 | Daily automation | AC-19.1–19.4 | S-18 | `src/automation/**`, `src/server/automation.ts`, `src/app/api/cron/**`, `src/app/api/batches/[id]/daily-check/**`, `vercel.json`, `src/email/**` |
| S-20 | Activity timeline; loop in docs | AC-20.1–20.2 | S-18, S-19 | `src/app/batches/[id]/page.tsx`, `src/components/app/{activity,how-it-works}.tsx`, `src/app/_components/automation.tsx`, `README.md` |

## 10. Stage table
| Story | Title | Depends on | Stage |
|---|---|---|---|
| S-1 | Skeleton | — | merged |
| S-2 | Domain basics | S-1 | merged |
| S-3 | Spreadsheet ingest | S-2 | merged |
| S-4 | Sample data | S-2 | merged |
| S-5 | Extraction | S-2 | merged |
| S-6 | Matching | S-2, S-5 | merged |
| S-7 | Rules, exposure, decision | S-6 | merged |
| S-8 | Pipeline + E2E | S-3, S-4, S-7 | merged |
| S-9 | DB, API, screens | S-8 | merged |
| S-10 | Email drafts and send | S-7, S-9 | merged |
| S-11 | Security, health, deploy, README | S-9, S-10 | merged |
| S-12 | Gemini provider | S-5, S-10 | merged |
| S-13 | Deterministic sample, no stuck batches | S-9, S-12 | merged |
| S-14 | Open sample data | S-11, S-13 | merged |
| S-15 | Frontend redesign | S-13, S-14 | merged |
| S-16 | Honest sample note; AI-quota message | S-12, S-15 | merged |
| S-17 | UI on shadcn/ui dashboard-01 | S-15, S-16 | checking |
| S-18 | Inbound documents | S-13, S-17 | checking |
| S-19 | Daily automation | S-18 | checking |
| S-20 | Activity timeline; loop in docs | S-18, S-19 | checking |

## 11. Sign-off on items without an automated test (2026-11-26, Aya, in chat)
After check round 4 (`docs/checks/2026-11-26-check-2.md`), Aya accepted:
- **AC-1.1**: verified by CI on the PR (lint, typecheck, unit, E2E and `pnpm build` all pass on 98f91d4). The auditor is not allowed to run `pnpm build`.
- **AC-11.4**: manual. The README sections were inspected by the auditor.
- **AC-12.7**: manual. The live run scored 105/106 fields, 17/17 needsReview and 12/12 payments against `expected.json` (see README "Live results").

### Sign-off for S-13 to S-16 (2026-11-26, Aya, in chat)
After check round `docs/checks/2026-11-26-check-5.md` (all automated checks pass), Aya accepted:
- **AC-14.3**: manual. While locked, protected actions show "Demo passcode required — ask Aya" (screenshots 08, 09).
- **AC-15.1**: manual. The redesign follows the 2026-11-26 brief (`docs/screenshots/01–17`).
- **AC-15.2**: tests, lint and typecheck verified by the auditor; build verified by CI on b2aa658; tabular numbers checked by hand.
