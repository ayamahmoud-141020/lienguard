# Phase 0 — Investigation (MVP, time-boxed)

Date: 2026-11-25. Scope: the four checks in PLAN.md §A.2 only.

## 1. Environment
| Tool | Status |
|---|---|
| Node | v22.23.3 ✓ |
| pnpm | 12.23.0 ✓ (installed via corepack) |
| git | 2.43 ✓ — repo-local identity `Aya Mahmoud Zaki <ayamahmoudzaki421@gmail.com>` |
| gh | active account `ayamahmoud-141020` (personal) ✓ |
| vercel CLI | not installed — use `pnpm dlx vercel` when deploying |

## 2. Anthropic — PDF input + structured output
Source: bundled Claude API reference for the official TypeScript SDK (`@anthropic-ai/sdk`), cached 2026-11-03.

- **PDF input:** a `document` content block placed before the text block:
  `{ type: "document", source: { type: "base64", media_type: "application/pdf", data: <b64> } }`.
  Limits: **32 MB per request**, **600 pages**. Our PDFs are 1–2 pages and well under 1 MB each.
- **Structured output:** `client.messages.parse({ ..., output_config: { format: zodOutputFormat(Schema) } })`,
  imported from `@anthropic-ai/sdk/helpers/zod`. Returns `parsed_output`, which is `null` if parsing failed, so we guard it.
  - The schema subset is supported, but `minimum`/`maximum`/`minLength` are not enforced by the API. The SDK strips them and validates client-side, so we **re-validate with our own Zod schema** anyway.
  - Every object must have `additionalProperties: false`. The Zod helper handles this.
  - Structured outputs can't be combined with citations. That's fine: we use our own `sourceText` field instead.
- **Model:** `claude-opus-5-5` is the current default ($4 / $20 per MTok). It is configured via `ANTHROPIC_MODEL`.
  - Thinking can't be disabled on this model. We set `output_config.effort: "low"` for extraction, which is a simple task, to keep cost and latency down.
  - Forced `tool_choice` returns a 400 on this model. That's another reason to use structured outputs rather than a forced tool.
- **Refusals:** check `stop_reason === "refusal"` (or `parsed_output === null`) → document `needsReview` → R12 HOLD. We enable the server-side fallback (`betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`) if it works with `parse`; otherwise the needsReview path covers it.
- **Cost estimate:** a 1–2 page PDF is about 3–5k input tokens and about 1k output tokens, so roughly **$0.03 per document**. A 12-PDF demo batch costs about **$0.40**, and the hash cache means re-runs are free.

## 3. Resend — Node send + idempotency
- Send: `resend.emails.send({ from, to, subject, html|text }, { idempotencyKey })`. Keys are kept **24 h**, max **256 chars**.
  We use `lienguard-draft/<emailDraftId>`.
  Source: https://resend.com/docs/dashboard/emails/idempotency-keys
- **Free plan:** **100 emails/day**, 3,000/month, 10 requests/second.
  Source: https://resend.com/docs/knowledge-base/account-quotas-and-limits
- Without a verified domain we send from `onboarding@resend.dev`. I believe this sender only delivers to the Resend account owner's own address, but I couldn't confirm it in the docs. It doesn't matter for the demo: `DEMO_EMAIL_OVERRIDE` sends every email to Aya's inbox. I'll confirm on the first real send.

## 4. Neon + Prisma on Vercel
Source: https://neon.com/docs/guides/prisma
- **Decision: Prisma 6** (Aya, 2026-11-25), using `url = env("DATABASE_URL")` (pooled) + `directUrl = env("DIRECT_URL")` in `schema.prisma`. Prisma 7 notes kept for reference.
- **Prisma 7:** the migration URL lives in `prisma.config.ts` (`datasource.url = env("DATABASE_URL_UNPOOLED")`, env loaded with dotenv). The `schema.prisma` datasource has **no `url`**.
- **Runtime:** use the driver adapter with the **pooled** URL:
  `new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) })`.
- Migrations use the **direct** (unpooled) URL. Run `prisma generate` after schema changes; `migrate dev` doesn't do it in 7.10.
- **Deploy:** set both URLs in Vercel. The build runs `prisma generate && prisma migrate deploy && next build`.
- **Tests:** domain, rules and the pipeline run against plain objects, not the DB. CI needs **no database**; the repository layer stays thin.

## 5. Vercel limits
Source: https://vercel.com/docs/functions/limitations
- **Request body: 4.5 MB** by default. The 20 MiB option needs the Pro plan, so on Hobby we assume 4.5 MB. Each upload request is one PDF, and we cap a file at **4 MB**.
- **Response body: 4.5 MB**. The PDF preview is served per document, which is fine.
- **Max duration (Hobby, Fluid compute): 300 s** default and max. One extraction call takes about 5–30 s, so it's safe. That confirms the one-PDF-per-request design.
- Memory: 2 GB on Hobby. Region defaults to `iad1`. Pick the Neon region in US East to match.

## 6. Decisions (proposed)
1. Stack as planned: Next.js App Router, TypeScript strict, Tailwind and shadcn/ui, **Prisma 6** (url + directUrl), Zod, SheetJS, pdf-lib, Resend, Vitest.
2. PDFs are stored in Postgres (`bytea`), so no Blob. That fits under the 4 MB per-file cap.
3. Extraction uses `claude-opus-5-5` with effort `low`, structured output, a Zod re-check, and a SHA-256 cache.
4. CI has no network and no DB: fixture extractor, fake email sender, pure-domain E2E against `samples/expected.json`.

## 7. Risks
- The `onboarding@resend.dev` restriction is unconfirmed, but it's covered by `DEMO_EMAIL_OVERRIDE`.
- The Hobby plan's 4.5 MB body cap means large real-world scans would need Blob client uploads. That goes in the v2 roadmap.
- Prisma 7 with the adapter is a newer setup. If it breaks on Vercel, fall back to Prisma 6 with `url`/`directUrl`.

## 8. Answers from Aya (2026-11-25)
- Model: `claude-opus-5-5`, effort `low`, from `ANTHROPIC_MODEL`.
- Vercel: free Hobby plan.
- Prisma 6 from the start.

## 9. Original open questions
1. Extraction model: OK with `claude-opus-5-5` at effort `low` (about $0.03 per document)? `claude-haiku-5-5` would be about 30× cheaper, but it's your call.
2. Vercel Hobby plan (free) — confirm you're on Hobby, not Pro.
