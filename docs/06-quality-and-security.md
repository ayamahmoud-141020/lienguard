# Quality and security

## Tests

There are 162 automated tests in 28 files. Every test name starts with the AC it covers. Tests use recorded readings and fake email and AI clients, so they need no network and no keys ([ADR-0003](decisions/0003-llm-behind-interfaces.md)).

| Type | Tests | Where |
|---|---|---|
| End to end on the samples | 3 | [`tests/e2e/samples.test.ts`](../tests/e2e/samples.test.ts) |
| Unit and integration | 159 | [`tests/unit/`](../tests/unit/) |

The biggest unit files are the rules (14 tests, [`tests/unit/rules.test.ts`](../tests/unit/rules.test.ts)), extraction (13, [`tests/unit/extraction.test.ts`](../tests/unit/extraction.test.ts)), the PDF-text check (13, [`tests/unit/grounding.test.ts`](../tests/unit/grounding.test.ts)) and the flows page (12, [`tests/unit/flows-page.test.ts`](../tests/unit/flows-page.test.ts)). The count per story is in [02-specs-index.md](02-specs-index.md).

Some tests exist to keep other things honest:
- The E2E test runs the whole pipeline on the samples and must match [`samples/expected.json`](../samples/expected.json) exactly (AC-8.1).
- [`tests/unit/flows.test.ts`](../tests/unit/flows.test.ts) fails if the `/flows` page names a file or function that no longer exists.
- [`tests/unit/docs.test.ts`](../tests/unit/docs.test.ts) does the same for these docs.
- A grep test keeps `Date.now()` and `new Date()` out of `src/domain/` (AC-7.14), so the rules depend only on the `today` they are given.

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every pull request and on every push to `main`. It installs with a frozen lockfile, then runs lint, typecheck, the unit tests, the E2E test and a production build. It sets `LIENGUARD_AI=fixture` and `LIENGUARD_EMAIL=fake`, so no real service is called.

## AI accuracy

The latest live run is recorded in the README ([`README.md`](../README.md), "Live results (2026-11-26)") and in [ADR-0009](decisions/0009-claude-in-production.md). It used `pnpm smoke:ai` ([`scripts/smoke-ai.ts`](../scripts/smoke-ai.ts)) on the 17 sample PDFs:

| Model | Fields matching the hand-checked readings | Other results |
|---|---|---|
| Claude `claude-opus-5-5`, low effort (production) | 105 / 106 | 17 / 17 documents got the right needs-review flag; about $0.58 for all 17 PDFs |
| Gemini `gemini-3.5-flash-lite` (earlier run) | 105 / 106 | 12 / 12 payments matched `samples/expected.json`, $162,500 exposed; all 6 email drafts passed the post-check first time |

In both runs the one miss was the blurry scan's amount, and that document went to review, which is the intended outcome. The Gemini result is also recorded in the sign-off for AC-12.7 ([spec §11](features/001-lienguard.md#11-sign-off-on-items-without-an-automated-test-2026-11-26-aya-in-chat)).

## The email post-check

The model writing an email sees only placeholders such as `{{AMOUNT_1}}` and `{{DATE_1}}`, never real numbers (AC-10.2). Code fills them in. [`src/email/postcheck.ts`](../src/email/postcheck.ts) then rejects:
- any amount or date that isn't in the payment data (AC-10.3);
- an email that leaves out an issue; for example an R06 hold must mention the notary (AC-10.4).

If the writer fails the post-check twice, a code template is used instead, and it passes the same check (AC-10.5). A person's own edit is saved, with a warning (AC-10.8). The daily digest has its own check of its numbers ([`src/automation/digest.ts`](../src/automation/digest.ts), AC-19.4).

## Every AI value must appear in the PDF

Added in S-24. [`src/ai/grounding.ts`](../src/ai/grounding.ts) checks each value the model returns against the PDF's text, which code takes out with `unpdf` ([`src/ai/pdf-text.ts`](../src/ai/pdf-text.ts)):
- Case, spaces, `$` and commas are ignored. A number is never found inside a longer number (AC-24.1).
- Sentences addressed to AI systems, such as "ignore previous instructions", don't count as the document's text (AC-24.4).
- A value that isn't found gets confidence 0, so the document goes to review and the payment is held under R12 (AC-24.2).

A test runs a fake model that obeys the sample injection ($1,000,000.00, unconditional). The payment stays on HOLD (AC-24.5). The known limits are in [08-limitations-and-next.md](08-limitations-and-next.md).

## Passcode and secrets

- **Passcode.** Uploads, extraction, evaluation, the manual daily check, editing and sending need the `x-demo-passcode` header. The sample batch, simulated reply, drafting, approving and skipping are open ([`src/server/access.ts`](../src/server/access.ts), AC-14.1). A test checks that every POST route is in exactly one of the two lists ([`tests/unit/security.test.ts`](../tests/unit/security.test.ts)).
- **Automation secrets.** `/api/inbound` needs `INBOUND_SECRET`, and the cron needs `CRON_SECRET`. Both are compared in constant time and never open when unset ([`src/server/automation.ts`](../src/server/automation.ts)).
- **Health.** `/api/health` reports only true/false for each env variable, never a value ([`src/server/health.ts`](../src/server/health.ts), AC-11.3).
- **Env errors.** A missing key's error names the variable and nothing else ([`src/env.ts`](../src/env.ts), AC-1.2).
- **Files kept out.** [`.vercelignore`](../.vercelignore) keeps env files and build output out of deploy uploads ([a31c60b](https://github.com/ayamahmoud-141020/lienguard/commit/a31c60b)).
- **One leak.** A Neon database password was committed once and then reset. See [05-what-the-process-caught.md](05-what-the-process-caught.md), item 5.

## Upload checks

[`src/server/uploads.ts`](../src/server/uploads.ts) checks every upload by its first bytes, not its file name: `%PDF-` for a PDF, `PK` for an `.xlsx`. It refuses empty files and files over 4 MB, and cleans the file name. A refused file is never stored (AC-11.2). Each PDF goes in its own request, which keeps every request under Vercel's body limit ([ADR-0006](decisions/0006-postgres-neon.md)).
