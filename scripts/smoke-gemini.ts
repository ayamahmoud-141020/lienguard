/**
 * Live smoke test (AC-12.7): reads every sample PDF with Gemini and compares each field
 * with the recorded fixture. Needs GEMINI_API_KEY in .env.local. Never runs in CI.
 *   pnpm smoke:gemini            # all sample PDFs
 *   pnpm smoke:gemini --models   # list the models this key can use
 * Prints field values from the fictional samples only; never prints env values.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { GeminiExtractor } from "@/ai/gemini-extractor";
import { toDocument } from "@/ai/to-document";
import type { ExtractionT } from "@/ai/schemas";
import { parseMoney } from "@/domain/money";
import { parseDate } from "@/domain/dates";
import { normalizeName } from "@/domain/matching/normalize";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const key = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-4-hydrogen";
if (!key) {
  console.error("GEMINI_API_KEY is not set (put it in .env.local in the project root).");
  process.exit(1);
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
  const extractor = GeminiExtractor.fromApiKey(key ?? "", model, 1);
  const files = readdirSync("samples/pdfs").filter((f) => f.endsWith(".pdf")).sort();
  console.log(`Model: ${model} · ${files.length} PDFs\n`);
  let total = 0;
  let agree = 0;
  let decisionsMatch = 0;
  const misses: string[] = [];
  for (const f of files) {
    const started = Date.now();
    const expected = JSON.parse(readFileSync(join("samples/fixtures", f.replace(/\.pdf$/, ".json")), "utf8")) as ExtractionT;
    const out = await extractor.extract({ bytes: new Uint8Array(readFileSync(join("samples/pdfs", f))), fileName: f });
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    if (!out.ok) {
      console.log(`✗ ${f} (${secs}s): ${out.reason}`);
      continue;
    }
    const rows = compare(expected, out.extraction);
    const n = rows.filter((r) => r.ok).length;
    total += rows.length;
    agree += n;
    const reviewE = toDocument(expected, { documentId: f, fileName: f }).needsReview;
    const reviewG = toDocument(out.extraction, { documentId: f, fileName: f }).needsReview;
    if (reviewE === reviewG) decisionsMatch++;
    console.log(`${n === rows.length ? "✓" : "•"} ${f} (${secs}s): ${n}/${rows.length} fields · needsReview expected ${reviewE}, got ${reviewG}`);
    for (const r of rows.filter((x) => !x.ok)) misses.push(`  ${f} ${r.field}: expected ${JSON.stringify(r.expected)}, got ${JSON.stringify(r.got)}`);
    if (/injection/.test(f)) console.log(`    notes: ${out.extraction.notes.slice(0, 160)}`);
  }
  console.log(`\nField agreement: ${agree}/${total} (${total ? ((100 * agree) / total).toFixed(1) : 0}%)`);
  console.log(`needsReview agreement: ${decisionsMatch}/${files.length}`);
  if (misses.length) console.log(`\nDifferences:\n${misses.join("\n")}`);
}

main().catch((e: unknown) => {
  const status = (e as { status?: number }).status;
  console.error(`Failed${status ? ` (HTTP ${status})` : ""}: ${e instanceof Error ? e.message.slice(0, 300) : "error"}`);
  process.exit(1);
});
