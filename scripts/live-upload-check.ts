/**
 * Live upload check on production: uploads the sample spreadsheets and PDFs through the same
 * API the "Upload your own batch" form uses, reads each PDF (one request per PDF), evaluates,
 * and compares every payment with samples/expected.json.
 *
 * `--fresh N` (default 2) gives N PDFs new bytes (same pages, new metadata) so they cannot be in
 * the extraction cache and must be read by the live AI. Other PDFs may come from the cache.
 *
 *   pnpm live:check [--fresh 2] [--url https://lienguard-one.vercel.app]
 *
 * Run by Aya: it needs DEMO_PASSCODE and DIRECT_URL from .env.local. Never prints env values.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { PrismaClient } from "@prisma/client";
import { sha256 } from "@/ai/hash";
import type { BatchResult } from "@/pipeline/evaluate";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const base = arg("--url") ?? "https://lienguard-one.vercel.app";
const fresh = Number(arg("--fresh") ?? 2);
const passcode = process.env.DEMO_PASSCODE;
if (!passcode || !process.env.DIRECT_URL) {
  console.error("DEMO_PASSCODE and DIRECT_URL must be set in .env.local.");
  process.exit(1);
}
const headers = { "x-demo-passcode": passcode, "x-demo-actor": "Live upload check" };

async function post(path: string, body?: FormData): Promise<Record<string, unknown>> {
  const res = await fetch(`${base}${path}`, { method: "POST", headers, body });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${String(json.error ?? "").slice(0, 200)}`);
  return json;
}

const file = (bytes: Uint8Array<ArrayBuffer>, name: string, type: string) => new File([bytes], name, { type });

async function freshCopy(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const doc = await PDFDocument.load(bytes);
  doc.setSubject(`LienGuard live upload check ${new Date().toISOString()}`);
  return new Uint8Array(await doc.save());
}

type Expected = { today: string; batchExposedCents: number; payments: { id: string; decision: string; ruleIds: string[]; exposedCents: number }[] };

async function main() {
  const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  try {
    const expected = JSON.parse(readFileSync("samples/expected.json", "utf8")) as Expected;
    const form = new FormData();
    form.set("name", `Live upload check ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`);
    form.set("payments", file(new Uint8Array(readFileSync("samples/payments.xlsx")), "payments.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
    form.set("subcontractors", file(new Uint8Array(readFileSync("samples/subcontractors.xlsx")), "subcontractors.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
    const { id } = (await post("/api/batches", form)) as { id: string };
    console.log(`Batch: ${base}/batches/${id}`);

    const names = readdirSync("samples/pdfs").filter((f) => f.endsWith(".pdf")).sort();
    // Fresh copies of one waiver and one COI, so at least one of each kind is read live.
    const freshNames = new Set([names.find((n) => n.startsWith("W")), names.find((n) => n.startsWith("C")), ...names.filter((n) => n.startsWith("W"))].filter(Boolean).slice(0, fresh) as string[]);
    const live = new Set<string>();
    for (const name of names) {
      let bytes = new Uint8Array(readFileSync(join("samples/pdfs", name)));
      if (freshNames.has(name)) bytes = await freshCopy(bytes);
      const cached = await db.extractionCache.findUnique({ where: { sha256: sha256(bytes) }, select: { sha256: true } });
      if (!cached) live.add(name);
      const one = new FormData();
      one.set("file", file(bytes, name, "application/pdf"));
      await post(`/api/batches/${id}/documents`, one);
    }
    console.log(`Uploaded ${names.length} PDFs: ${live.size} not in the cache (read live): ${[...live].join(", ") || "none"}\n`);

    const docs = await db.document.findMany({ where: { batchId: id }, select: { id: true, fileName: true }, orderBy: { fileName: "asc" } });
    for (const d of docs) {
      const started = Date.now();
      const r = (await post(`/api/batches/${id}/documents/${d.id}/extract`)) as { status: string; notice: string | null };
      console.log(`  ${r.status === "done" ? "✓" : "•"} ${d.fileName}: ${r.status} (${((Date.now() - started) / 1000).toFixed(1)}s${live.has(d.fileName) ? ", live" : ", cached"})${r.notice ? ` ${r.notice}` : ""}`);
    }
    await post(`/api/batches/${id}/evaluate`);

    const batch = await db.batch.findUnique({ where: { id }, select: { status: true, today: true, resultJson: true } });
    const result = batch?.resultJson as unknown as BatchResult | null;
    if (!result) throw new Error(`batch has no result (status ${batch?.status ?? "missing"})`);
    let same = 0;
    for (const e of expected.payments) {
      const p = result.payments.find((x) => x.payment.id === e.id);
      const got = p ? { decision: p.evaluation.decision, ruleIds: p.evaluation.findings.map((f) => f.ruleId).sort(), exposedCents: p.evaluation.exposedCents } : null;
      const ok = JSON.stringify(got) === JSON.stringify({ decision: e.decision, ruleIds: [...e.ruleIds].sort(), exposedCents: e.exposedCents });
      if (ok) same++;
      else console.log(`  ≠ ${e.id}: expected ${e.decision} ${e.ruleIds.join("+")} $${e.exposedCents / 100}, got ${got ? `${got.decision} ${got.ruleIds.join("+")} $${got.exposedCents / 100}` : "missing"}`);
    }
    console.log(`\nStatus: ${batch?.status} · demo date ${batch?.today} (expected.json uses ${expected.today})`);
    console.log(`Payments matching expected.json: ${same}/${expected.payments.length}`);
    console.log(`Batch exposure: $${(result.exposedCents / 100).toLocaleString("en-US")} (expected $${(expected.batchExposedCents / 100).toLocaleString("en-US")})`);
    console.log(`Open it: ${base}/batches/${id}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(`Failed: ${e instanceof Error ? e.message.slice(0, 300) : "error"}`);
  process.exit(1);
});
