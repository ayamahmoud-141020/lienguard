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
- **AC-9.1** [R-11] `POST /api/batches/sample` (with passcode) creates a batch from `samples/` and returns its id. Calling it again creates a separate batch. Within a batch, the same PDF bytes are stored once (unique `batchId + sha256`).
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
- **AC-11.1** [R-14] Every write route (`sample`, `extract`, `drafts`, `approve`, `edit`, `skip`, `send`) returns 401 without the correct `x-demo-passcode` header.
- **AC-11.2** [R-14] An upload whose bytes don't start with `%PDF-` (or `PK` for xlsx), or that is larger than 4 MB, returns 400 and is not stored.
- **AC-11.3** [R-14] `GET /api/health` returns `{ ok, db: boolean, env: { [name]: boolean } }` and never any env value (tested by checking that no env value appears in the response).
- **AC-11.4** [R-11] The README has these sections: problem, live link and passcode, where AI is and isn't used, how it was built, run locally, next steps, disclaimer. *(manual check)*

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
| Story | Title | ACs | Depends on | Likely files |
|---|---|---|---|---|
| S-1 | Skeleton: Next.js, Prisma 6, Tailwind, Vitest, CI, env schema | AC-1.1–1.2 | — | `package.json`, `src/env.ts`, `prisma/schema.prisma` |
| S-2 | Domain: money, dates, name normalization | AC-2.1–2.5 | S-1 | `src/domain/{money,dates}.ts`, `src/domain/matching/normalize.ts` |
| S-3 | Spreadsheet ingest with Zod | AC-3.1–3.4 | S-2 | `src/ingest/spreadsheets.ts` |
| S-4 | Sample generator, fixtures, expected.json | AC-4.1–4.4 | S-2 | `scripts/generate-samples.ts`, `samples/**` |
| S-5 | Extraction: schemas, toDocument, fixture/Anthropic extractors, cache | AC-5.1–5.6 | S-2 | `src/ai/*` |
| S-6 | Matching | AC-6.1–6.5 | S-2, S-5 | `src/domain/matching/match.ts` |
| S-7 | Rules, exposure, decision | AC-7.1–7.14 | S-6 | `src/domain/rules/*`, `src/domain/{exposure,decision}.ts`, `config/states.json` |
| S-8 | Batch pipeline + E2E on samples | AC-8.1–8.3 | S-3, S-4, S-7 | `src/pipeline/run-batch.ts`, `tests/e2e/samples.test.ts` |
| S-9 | DB, API and screens: sample batch, processing, dashboard, detail | AC-9.1–9.4 | S-8 | `src/db/*`, `src/app/**` |
| S-10 | Email writer, post-check, drafts, Resend send, audit | AC-10.1–10.9 | S-7, S-9 | `src/ai/email-*`, `src/ai/postcheck.ts`, `src/email/*`, `src/app/**/drafts` |
| S-11 | Passcode, upload checks, health, deploy, README | AC-11.1–11.4 | S-9, S-10 | `src/lib/guard.ts`, `src/app/api/health`, `README.md` |

## 10. Stage table
| Story | Title | Depends on | Stage |
|---|---|---|---|
| S-1 | Skeleton | — | checking |
| S-2 | Domain basics | S-1 | checking |
| S-3 | Spreadsheet ingest | S-2 | checking |
| S-4 | Sample data | S-2 | agreed |
| S-5 | Extraction | S-2 | agreed |
| S-6 | Matching | S-2, S-5 | agreed |
| S-7 | Rules, exposure, decision | S-6 | agreed |
| S-8 | Pipeline + E2E | S-3, S-4, S-7 | agreed |
| S-9 | DB, API, screens | S-8 | agreed |
| S-10 | Email drafts and send | S-7, S-9 | agreed |
| S-11 | Security, health, deploy, README | S-9, S-10 | agreed |
