/**
 * Live smoke test (AC-12.7): reads every sample PDF with the live AI (Claude or Gemini, from
 * LIENGUARD_AI or --provider) and compares each field with the hand-checked fixture. Never runs in CI.
 *   pnpm smoke:ai                       # provider from LIENGUARD_AI in .env.local
 *   pnpm smoke:ai --provider gemini     # or: pnpm smoke:gemini
 *   pnpm smoke:ai --models              # list the Gemini models this key can use
 *   pnpm smoke:ai --batch <id>          # score readings already stored for a batch (no AI calls)
 * Each live reading is cached in .cache/readings/<model>/<sha256>.json, so re-runs never pay to
 * read the same PDF twice. Claude spend is totalled in .cache/spend.json.
 * Prints field values from the fictional samples only; never prints env values.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { PrismaClient } from "@prisma/client";
import type { ExtractOutcome } from "@/ai/extractor";
import { GeminiExtractor } from "@/ai/gemini-extractor";
import { AnthropicExtractor } from "@/ai/anthropic-extractor";
import type { Extractor } from "@/ai/extractor";
import { sha256 } from "@/ai/hash";
import { recordSpend, spendSummary } from "./lib/spend";
import { toDocument } from "@/ai/to-document";
import type { ExtractionT } from "@/ai/schemas";
import { parseMoney } from "@/domain/money";
import { parseDate } from "@/domain/dates";
import { normalizeName } from "@/domain/matching/normalize";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const providerArg = process.argv.indexOf("--provider");
const provider = (providerArg > 0 ? process.argv[providerArg + 1] : process.env.LIENGUARD_AI) === "anthropic" ? "anthropic" : "gemini";
const key = provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.GEMINI_API_KEY;
const model = provider === "anthropic" ? process.env.ANTHROPIC_MODEL || "claude-opus-5-5" : process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const batchArg = process.argv.indexOf("--batch");
const batchId = batchArg > 0 ? process.argv[batchArg + 1] : undefined;
if (!key && !batchId) {
  console.error(`${provider === "anthropic" ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY"} is not set (put it in .env.local in the project root).`);
  process.exit(1);
}

function liveExtractor(): Extractor {
  if (provider === "gemini") return GeminiExtractor.fromApiKey(key ?? "", model, 1);
  const client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 120_000 });
  return new AnthropicExtractor(async (req) => {
    const res = await client.messages.parse(req);
    recordSpend("smoke:ai", model, res.usage);
    return res;
  }, model);
}

/** Reads a PDF once per model; later runs reuse the stored reading at no cost. */
async function cachedRead(extractor: Extractor, bytes: Uint8Array, fileName: string): Promise<{ out: ExtractOutcome; cached: boolean }> {
  const dir = join(".cache", "readings", model);
  const path = join(dir, `${sha256(bytes)}.json`);
  if (existsSync(path)) return { out: JSON.parse(readFileSync(path, "utf8")) as ExtractOutcome, cached: true };
  const out = await extractor.extract({ bytes, fileName });
  if (out.ok) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(out));
  }
  return { out, cached: false };
}

type Cell = { value: unknown } | null | undefined;
const norm = (field: string, v: unknown): unknown => {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return v;
  if (field === "amount") {
    const m = parseMoney(v);
    return m.ok ? m.cents : `?${v}`;
  }
  if (field === "throughDate" || field === "glExpiry") {
    const d = parseDate(v);
    return d.ok ? d.date : `?${v}`;
  }
  if (/Name$|Holder$/.test(field)) return normalizeName(v);
  return v.trim().toLowerCase();
};

function compare(expected: ExtractionT, got: ExtractionT) {
  const rows: { field: string; ok: boolean; expected: unknown; got: unknown }[] = [];
  rows.push({ field: "kind", ok: expected.kind === got.kind, expected: expected.kind, got: got.kind });
  for (const part of ["waiver", "coi"] as const) {
    const e = expected[part] as Record<string, Cell> | null;
    if (!e) continue;
    const g = (got[part] ?? {}) as Record<string, Cell>;
    for (const field of Object.keys(e)) {
      if (field === "exceptions" || field === "customerName" || field === "projectName" || field === "certificateHolder") continue;
      const ev = norm(field, e[field]?.value);
      const gv = norm(field, g[field]?.value);
      rows.push({ field: `${part}.${field}`, ok: JSON.stringify(ev) === JSON.stringify(gv), expected: ev, got: gv });
    }
  }
  return rows;
}

async function main() {
  if (process.argv.includes("--models")) {
    const ai = new GoogleGenAI({ apiKey: key });
    const pager = await ai.models.list();
    for await (const m of pager) if (m.supportedActions?.includes("generateContent")) console.log(m.name);
    return;
  }
  let stored: Map<string, ExtractOutcome> | undefined;
  if (batchId) {
    const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
    const docs = await db.document.findMany({ where: { batchId }, select: { fileName: true, extractionJson: true } });
    await db.$disconnect();
    stored = new Map(docs.map((d) => [d.fileName, (d.extractionJson ?? { ok: false, reason: "not read yet" }) as unknown as ExtractOutcome]));
  }
  const extractor = liveExtractor();
  const files = readdirSync("samples/pdfs").filter((f) => f.endsWith(".pdf")).sort();
  console.log(stored ? `Stored readings of batch ${batchId} · ${files.length} PDFs\n` : `Provider: ${provider} · model ${model} · ${files.length} PDFs\n`);
  let total = 0;
  let agree = 0;
  let decisionsMatch = 0;
  const misses: string[] = [];
  for (const f of files) {
    const started = Date.now();
    const expected = JSON.parse(readFileSync(join("samples/fixtures", f.replace(/\.pdf$/, ".json")), "utf8")) as ExtractionT;
    const read = stored
      ? { out: stored.get(f) ?? { ok: false as const, reason: "not in this batch" }, cached: true }
      : await cachedRead(extractor, new Uint8Array(readFileSync(join("samples/pdfs", f))), f);
    const out = read.out;
    const secs = read.cached && !stored ? "cached" : `${((Date.now() - started) / 1000).toFixed(1)}s`;
    if (!out.ok) {
      console.log(`✗ ${f} (${secs}): ${out.reason}`);
      continue;
    }
    const rows = compare(expected, out.extraction);
    const n = rows.filter((r) => r.ok).length;
    total += rows.length;
    agree += n;
    const reviewE = toDocument(expected, { documentId: f, fileName: f }).needsReview;
    const reviewG = toDocument(out.extraction, { documentId: f, fileName: f }).needsReview;
    if (reviewE === reviewG) decisionsMatch++;
    console.log(`${n === rows.length ? "✓" : "•"} ${f} (${secs}): ${n}/${rows.length} fields · needsReview expected ${reviewE}, got ${reviewG}`);
    for (const r of rows.filter((x) => !x.ok)) misses.push(`  ${f} ${r.field}: expected ${JSON.stringify(r.expected)}, got ${JSON.stringify(r.got)}`);
    if (/injection/.test(f)) console.log(`    notes: ${out.extraction.notes.slice(0, 160)}`);
  }
  console.log(`\nField agreement: ${agree}/${total} (${total ? ((100 * agree) / total).toFixed(1) : 0}%)`);
  console.log(`needsReview agreement: ${decisionsMatch}/${files.length}`);
  if (misses.length) console.log(`\nDifferences:\n${misses.join("\n")}`);
  if (provider === "anthropic") console.log(`\n${spendSummary()}`);
}

main().catch((e: unknown) => {
  const status = (e as { status?: number }).status;
  console.error(`Failed${status ? ` (HTTP ${status})` : ""}: ${e instanceof Error ? e.message.slice(0, 300) : "error"}`);
  process.exit(1);
});
