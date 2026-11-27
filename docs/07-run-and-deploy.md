# Run and deploy

## Run locally

You need Node 20 or later and pnpm ([`package.json`](../package.json)).

```bash
pnpm install
cp .env.example .env.local      # then fill in your own values
pnpm prisma migrate deploy      # needs DATABASE_URL and DIRECT_URL in the shell
pnpm dev                        # http://localhost:3000 → "Use sample data"
```

To run the whole app with no API keys, set `LIENGUARD_AI=fixture` and `LIENGUARD_EMAIL=fake`. PDFs are then "read" from the recorded readings, and emails are only recorded, not sent ([`src/env.ts`](../src/env.ts)). A database is still needed for the app itself; the tests don't need one.

| Command | What it does |
|---|---|
| `pnpm test` | All tests: no network, no keys, no database |
| `pnpm lint`, `pnpm typecheck` | ESLint and `tsc --noEmit` |
| `pnpm build` | Production build |
| `pnpm samples` | Rebuild the fictional sample batch ([`scripts/generate-samples.ts`](../scripts/generate-samples.ts)) |
| `pnpm smoke:ai` | **Live, costs money:** the configured AI reads the 17 sample PDFs and is scored against the recorded readings ([`scripts/smoke-ai.ts`](../scripts/smoke-ai.ts)) |
| `pnpm record:drafts` | **Live:** records the sample batch's email wording ([`scripts/record-sample-drafts.ts`](../scripts/record-sample-drafts.ts)) |
| `pnpm live:check` | Uploads the sample batch to production through the real API and compares the result with `samples/expected.json`; needs the passcode ([`scripts/live-upload-check.ts`](../scripts/live-upload-check.ts)) |
| `pnpm screenshots` | Retakes the README screenshots against a local build ([`scripts/screenshots.ts`](../scripts/screenshots.ts)) |

## Environment variables

Names only. Real values go in `.env.local`, which is never committed. The schema and defaults are in [`src/env.ts`](../src/env.ts); the database URLs are read by [`prisma/schema.prisma`](../prisma/schema.prisma).

| Name | What it is for |
|---|---|
| `DATABASE_URL` | Pooled Postgres connection, used by the app |
| `DIRECT_URL` | Direct Postgres connection, used for migrations |
| `LIENGUARD_AI` | Which reader: `anthropic`, `gemini` or `fixture` (default `fixture`) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Claude key and model (default `claude-opus-5-5`) |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_MAX_CONCURRENCY` | Gemini key, model (default `gemini-3.5-flash-lite`) and requests at once (default 2) |
| `LIENGUARD_EMAIL` | `resend` or `fake` (default `fake`) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend key and the sender address |
| `DEMO_EMAIL_OVERRIDE` | Every demo email goes to this address instead |
| `AP_INBOX` | Where notifications and the daily digest go |
| `DEMO_PASSCODE` | The passcode for uploads, edits and sending |
| `INBOUND_SECRET` | Secret for `/api/inbound` |
| `CRON_SECRET` | Secret for the daily cron |
| `DEMO_TODAY` | The demo date the rules run against (default `2026-11-20`) |

The app fails at start if the chosen AI's key is missing, and the error names the variable only (AC-1.2, AC-12.1).

## Sample data

[`samples/`](../samples/) holds a fictional batch: 12 payments across 3 projects (CA, TX, AZ) and 6 subcontractors, and 17 PDFs. These include waivers in three layouts, insurance certificates, a blurry scan and a prompt-injection test. Every PDF has a hand-checked reading in [`samples/fixtures/`](../samples/fixtures/), and the right answers are in [`samples/expected.json`](../samples/expected.json): 2 SAFE, 10 HOLD, $162,500 exposed ([`samples/EXPECTED.md`](../samples/EXPECTED.md)). [`samples/inbound/`](../samples/inbound/) holds a corrected waiver used as the "subcontractor reply". "Use sample data" in the app makes no AI calls (AC-13.1, AC-21.1).

## Deploy

The live app runs on Vercel at https://lienguard-one.vercel.app.
- Vercel runs the `vercel-build` script: `prisma generate && prisma migrate deploy && next build` ([`package.json`](../package.json)). So database migrations in [`prisma/migrations/`](../prisma/migrations/) are applied on each deploy.
- The daily cron is set in [`vercel.json`](../vercel.json): `/api/cron/daily` at 07:00 UTC.
- The database is Neon Postgres ([ADR-0006](decisions/0006-postgres-neon.md)).
- Set the environment variables above in the Vercel project. `/api/health` then shows which ones are set, as true or false.
- Production reads uploads with Claude (`LIENGUARD_AI=anthropic`, [ADR-0009](decisions/0009-claude-in-production.md)).

## Cost per document

- **An uploaded PDF read by Claude:** about 3.4 cents. The smoke run cost $0.58 for 17 PDFs ([ADR-0009](decisions/0009-claude-in-production.md)).
- **The same PDF again:** free. Readings are cached by file hash ([ADR-0004](decisions/0004-extraction-cache.md)).
- **The sample batch:** no AI calls at all. Its readings and email wording are recorded.
- **Spend limit:** production runs on a prepaid key with no auto-reload. When it runs out, documents go to needs review and are held, never passed (ADR-0009).
