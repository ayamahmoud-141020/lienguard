import { join } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { loadEnv } from "@/env";
import { cachedExtract, type ExtractionCache } from "@/ai/cache";
import { AnthropicExtractor } from "@/ai/anthropic-extractor";
import { Extraction } from "@/ai/schemas";
import { toDocument } from "@/ai/to-document";
import type { ExtractOutcome, Extractor } from "@/ai/extractor";
import { evaluateBatch, type BatchInput, type BatchResult, type ExtractedDocument } from "@/pipeline/evaluate";
import { loadFixtureExtractor, readBatchSpreadsheets } from "@/pipeline/samples";
import { dedupeDocuments } from "@/pipeline/documents";
import type { RowError } from "@/ingest/spreadsheets";

const SAMPLES_DIR = join(process.cwd(), "samples");

export function getExtractor(): Extractor {
  const env = loadEnv();
  if (env.LIENGUARD_AI === "fixture") return loadFixtureExtractor(SAMPLES_DIR);
  return AnthropicExtractor.fromApiKey(env.ANTHROPIC_API_KEY ?? "", env.ANTHROPIC_MODEL);
}

const dbCache: ExtractionCache = {
  async get(sha) {
    const row = await prisma.extractionCache.findUnique({ where: { sha256: sha } });
    if (!row) return null;
    const parsed = Extraction.safeParse(row.json);
    return parsed.success ? parsed.data : null;
  },
  async set(sha, extraction) {
    const json = extraction as unknown as Prisma.InputJsonValue;
    await prisma.extractionCache.upsert({ where: { sha256: sha }, create: { sha256: sha, json }, update: { json } });
  },
};

async function insertDocuments(batchId: string, files: { fileName: string; bytes: Uint8Array }[]) {
  for (const d of dedupeDocuments(files)) {
    await prisma.document.upsert({
      where: { batchId_sha256: { batchId, sha256: d.sha256 } },
      create: { batchId, fileName: d.fileName, sha256: d.sha256, bytes: Buffer.from(d.bytes) },
      update: {},
    });
  }
}

export async function createSampleBatch(): Promise<string> {
  const env = loadEnv();
  const { input, errors } = readBatchSpreadsheets(readFileSync(join(SAMPLES_DIR, "payments.xlsx")), readFileSync(join(SAMPLES_DIR, "subcontractors.xlsx")));
  if (errors.length) throw new Error("sample spreadsheets are invalid");
  const count = await prisma.batch.count();
  const batch = await prisma.batch.create({
    data: { name: `Sample batch #${count + 1} · November payments`, today: env.DEMO_TODAY, inputJson: input as unknown as Prisma.InputJsonValue },
  });
  const files = readdirSync(join(SAMPLES_DIR, "pdfs"))
    .filter((f) => f.endsWith(".pdf"))
    .sort()
    .map((fileName) => ({ fileName, bytes: new Uint8Array(readFileSync(join(SAMPLES_DIR, "pdfs", fileName))) }));
  await insertDocuments(batch.id, files);
  return batch.id;
}

export async function createUploadBatch(name: string, paymentsXlsx: Uint8Array, subsXlsx: Uint8Array): Promise<{ id: string | null; errors: RowError[] }> {
  const env = loadEnv();
  const { input, errors } = readBatchSpreadsheets(paymentsXlsx, subsXlsx);
  if (input.payments.length === 0) return { id: null, errors };
  const batch = await prisma.batch.create({
    data: { name: name || "Uploaded batch", today: env.DEMO_TODAY, inputJson: input as unknown as Prisma.InputJsonValue },
  });
  return { id: batch.id, errors };
}

export async function addDocument(batchId: string, fileName: string, bytes: Uint8Array): Promise<void> {
  await insertDocuments(batchId, [{ fileName, bytes }]);
  await prisma.batch.update({ where: { id: batchId }, data: { status: "processing" } });
}

/** Extracts one document (one request per PDF). Cached by file hash, so re-runs cost nothing. */
export async function extractDocument(batchId: string, documentId: string): Promise<"done" | "needs review"> {
  const doc = await prisma.document.findFirst({ where: { id: documentId, batchId } });
  if (!doc) throw new Error("document not found");
  const outcome = await cachedExtract(getExtractor(), dbCache, { bytes: new Uint8Array(doc.bytes), fileName: doc.fileName });
  const review = !outcome.ok || toDocument(outcome.extraction, { documentId: doc.id, fileName: doc.fileName }).needsReview;
  await prisma.document.update({
    where: { id: doc.id },
    data: { extractionJson: outcome as unknown as Prisma.InputJsonValue, status: review ? "needs_review" : "done" },
  });
  return review ? "needs review" : "done";
}

function outcomeOf(json: Prisma.JsonValue | null): ExtractOutcome {
  if (!json || typeof json !== "object" || Array.isArray(json)) return { ok: false, reason: "not read yet" };
  const o = json as { ok?: unknown; extraction?: unknown; reason?: unknown };
  if (o.ok === true) {
    const parsed = Extraction.safeParse(o.extraction);
    return parsed.success ? { ok: true, extraction: parsed.data } : { ok: false, reason: "stored extraction is invalid" };
  }
  return { ok: false, reason: typeof o.reason === "string" ? o.reason : "could not be read" };
}

/** Re-runs matching + rules from stored extractions (no LLM call). */
export async function evaluateStoredBatch(batchId: string): Promise<BatchResult> {
  const batch = await prisma.batch.findUniqueOrThrow({ where: { id: batchId } });
  const docs = await prisma.document.findMany({ where: { batchId }, orderBy: { fileName: "asc" }, select: { id: true, fileName: true, extractionJson: true } });
  const extracted: ExtractedDocument[] = docs.map((d) => ({ id: d.id, fileName: d.fileName, outcome: outcomeOf(d.extractionJson) }));
  const result = evaluateBatch(batch.inputJson as unknown as BatchInput, extracted, batch.today);
  await prisma.batch.update({ where: { id: batchId }, data: { resultJson: result as unknown as Prisma.InputJsonValue, status: "ready" } });
  return result;
}

export async function getBatchView(batchId: string) {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { id: true, name: true, createdAt: true, status: true, today: true, resultJson: true },
  });
  if (!batch) return null;
  const documents = await prisma.document.findMany({ where: { batchId }, orderBy: { fileName: "asc" }, select: { id: true, fileName: true, status: true } });
  return { ...batch, result: (batch.resultJson as unknown as BatchResult | null) ?? null, documents };
}

export async function listBatches() {
  const rows = await prisma.batch.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { id: true, name: true, createdAt: true, status: true, resultJson: true } });
  return rows.map((b) => {
    const r = b.resultJson as unknown as BatchResult | null;
    return { id: b.id, name: b.name, createdAt: b.createdAt, status: b.status, exposedCents: r?.exposedCents ?? null, hold: r?.counts.hold ?? null };
  });
}
