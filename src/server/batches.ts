import { join } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { loadEnv } from "@/env";
import { cachedExtract, type ExtractionCache } from "@/ai/cache";
import { AnthropicExtractor } from "@/ai/anthropic-extractor";
import { GeminiExtractor } from "@/ai/gemini-extractor";
import { Extraction } from "@/ai/schemas";
import type { ExtractOutcome, Extractor } from "@/ai/extractor";
import { evaluateBatch, type BatchInput, type BatchResult, type ExtractedDocument } from "@/pipeline/evaluate";
import { loadFixtureExtractor, readBatchSpreadsheets } from "@/pipeline/samples";
import { dedupeDocuments } from "@/pipeline/documents";
import { finishBatch, nextBatchAction, readDocument, samplesToDelete } from "@/pipeline/lifecycle";
import type { RowError } from "@/ingest/spreadsheets";

const SAMPLES_DIR = join(process.cwd(), "samples");

export function getExtractor(): Extractor {
  const env = loadEnv();
  if (env.LIENGUARD_AI === "fixture") return loadFixtureExtractor(SAMPLES_DIR);
  if (env.LIENGUARD_AI === "gemini") return GeminiExtractor.fromApiKey(env.GEMINI_API_KEY ?? "", env.GEMINI_MODEL, env.GEMINI_MAX_CONCURRENCY);
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

export type StoredDocument = { fileName: string; sha256: string; bytes: Uint8Array; outcome?: ExtractOutcome; status?: "queued" | "done" | "needs_review" };

/** Persistence used when creating batches. Prisma in the app; an in-memory version in tests. */
export interface BatchStore {
  countBatches(kind: string): Promise<number>;
  createBatch(b: { name: string; today: string; kind: string; input: BatchInput }): Promise<string>;
  /** Must keep one document per (batchId, sha256), like the DB unique key. Returns the document id. */
  addDocument(d: StoredDocument & { batchId: string }): Promise<string>;
  finishReady(batchId: string, result: BatchResult): Promise<void>;
  listBatches(): Promise<{ id: string; kind: string; createdAt: Date }[]>;
  deleteBatches(ids: string[]): Promise<void>;
}

const json = (v: unknown) => v as Prisma.InputJsonValue;

export const prismaBatchStore: BatchStore = {
  countBatches: (kind) => prisma.batch.count({ where: { kind } }),
  async createBatch(b) {
    const row = await prisma.batch.create({ data: { name: b.name, today: b.today, kind: b.kind, inputJson: json(b.input) } });
    return row.id;
  },
  async addDocument(d) {
    const row = await prisma.document.upsert({
      where: { batchId_sha256: { batchId: d.batchId, sha256: d.sha256 } },
      create: {
        batchId: d.batchId,
        fileName: d.fileName,
        sha256: d.sha256,
        bytes: Buffer.from(d.bytes),
        status: d.status ?? "queued",
        ...(d.outcome ? { extractionJson: json(d.outcome) } : {}),
      },
      update: {},
      select: { id: true },
    });
    return row.id;
  },
  async finishReady(batchId, result) {
    await prisma.batch.update({ where: { id: batchId }, data: { resultJson: json(result), status: "ready", error: null } });
  },
  listBatches: () => prisma.batch.findMany({ select: { id: true, kind: true, createdAt: true } }),
  async deleteBatches(ids) {
    if (ids.length) await prisma.batch.deleteMany({ where: { id: { in: ids } } });
  },
};

const MAX_SAMPLE_BATCHES = 20;

/**
 * Creates a new, finished batch from samples/ (each click is its own batch).
 * Readings come from the recorded fixtures, never the live AI, so the result equals
 * expected.json every time and costs nothing (AC-13.1). Keeps the newest 20 (AC-14.2).
 */
export async function createSampleBatch(store: BatchStore = prismaBatchStore, samplesDir: string = SAMPLES_DIR, today: string = loadEnv().DEMO_TODAY): Promise<string> {
  const { input, errors } = readBatchSpreadsheets(readFileSync(join(samplesDir, "payments.xlsx")), readFileSync(join(samplesDir, "subcontractors.xlsx")));
  if (errors.length) throw new Error("sample spreadsheets are invalid");
  const recorded = loadFixtureExtractor(samplesDir);
  const count = await store.countBatches("sample");
  const batchId = await store.createBatch({ name: `Sample batch #${count + 1} · November payments`, today, kind: "sample", input });
  const files = readdirSync(join(samplesDir, "pdfs"))
    .filter((f) => f.endsWith(".pdf"))
    .sort()
    .map((fileName) => ({ fileName, bytes: new Uint8Array(readFileSync(join(samplesDir, "pdfs", fileName))) }));
  const extracted: ExtractedDocument[] = [];
  for (const d of dedupeDocuments(files)) {
    const read = await readDocument(() => recorded.extract({ bytes: d.bytes, fileName: d.fileName }), { documentId: d.sha256, fileName: d.fileName });
    const id = await store.addDocument({ batchId, fileName: d.fileName, sha256: d.sha256, bytes: d.bytes, outcome: read.outcome, status: read.status });
    extracted.push({ id, fileName: d.fileName, outcome: read.outcome });
  }
  await store.finishReady(batchId, evaluateBatch(input, extracted, today));
  await store.deleteBatches(samplesToDelete(await store.listBatches(), MAX_SAMPLE_BATCHES));
  return batchId;
}

export async function createUploadBatch(name: string, paymentsXlsx: Uint8Array, subsXlsx: Uint8Array): Promise<{ id: string | null; errors: RowError[] }> {
  const env = loadEnv();
  const { input, errors } = readBatchSpreadsheets(paymentsXlsx, subsXlsx);
  if (input.payments.length === 0) return { id: null, errors };
  const id = await prismaBatchStore.createBatch({ name: name || "Uploaded batch", today: env.DEMO_TODAY, kind: "upload", input });
  return { id, errors };
}

export async function addDocument(batchId: string, fileName: string, bytes: Uint8Array): Promise<void> {
  for (const d of dedupeDocuments([{ fileName, bytes }])) await prismaBatchStore.addDocument({ batchId, fileName: d.fileName, sha256: d.sha256, bytes: d.bytes });
  await prisma.batch.update({ where: { id: batchId }, data: { status: "processing" } });
}

/** Extracts one document (one request per PDF). Cached by file hash, so re-runs cost nothing. Never throws past here (AC-13.2). */
export async function extractDocument(batchId: string, documentId: string): Promise<"done" | "needs review"> {
  const doc = await prisma.document.findFirst({ where: { id: documentId, batchId } });
  if (!doc) throw new Error("document not found");
  const read = await readDocument(() => cachedExtract(getExtractor(), dbCache, { bytes: new Uint8Array(doc.bytes), fileName: doc.fileName }), { documentId: doc.id, fileName: doc.fileName });
  await prisma.document.update({ where: { id: doc.id }, data: { extractionJson: json(read.outcome), status: read.status } });
  await prisma.batch.update({ where: { id: batchId }, data: { updatedAt: new Date() } });
  return read.status === "done" ? "done" : "needs review";
}

/** A stored reading as an ExtractOutcome; missing or invalid means not read → needs review. */
export function storedOutcome(json: Prisma.JsonValue | null): ExtractOutcome {
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
  await prisma.document.updateMany({
    where: { batchId, status: "queued" },
    data: { status: "needs_review", extractionJson: json({ ok: false, reason: "reading was interrupted before this document was read" }) },
  });
  const docs = await prisma.document.findMany({ where: { batchId }, orderBy: { fileName: "asc" }, select: { id: true, fileName: true, extractionJson: true } });
  const extracted: ExtractedDocument[] = docs.map((d) => ({ id: d.id, fileName: d.fileName, outcome: storedOutcome(d.extractionJson) }));
  const result = evaluateBatch(batch.inputJson as unknown as BatchInput, extracted, batch.today);
  await prisma.batch.update({ where: { id: batchId }, data: { resultJson: json(result), status: "ready", error: null } });
  return result;
}

/** Finishes a batch; on error it becomes `failed` with a readable message (AC-13.4). */
export function finishStoredBatch(batchId: string): Promise<"ready" | "failed"> {
  return finishBatch(batchId, evaluateStoredBatch, async (id, message) => {
    await prisma.batch.update({ where: { id }, data: { status: "failed", error: message } });
  });
}

export async function getBatchView(batchId: string) {
  const load = async () => {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      select: { id: true, name: true, createdAt: true, updatedAt: true, status: true, kind: true, error: true, today: true, resultJson: true },
    });
    if (!batch) return null;
    const documents = await prisma.document.findMany({ where: { batchId }, orderBy: { fileName: "asc" }, select: { id: true, fileName: true, status: true } });
    return { ...batch, result: (batch.resultJson as unknown as BatchResult | null) ?? null, documents };
  };
  const view = await load();
  if (!view) return null;
  // A batch never stays "processing": finish it when nothing is left to read, or when it went idle (AC-13.3).
  if (nextBatchAction({ status: view.status, updatedAt: view.updatedAt, docStatuses: view.documents.map((d) => d.status) }, new Date()) === "evaluate") {
    await finishStoredBatch(batchId);
    return load();
  }
  return view;
}

export async function listBatches() {
  const rows = await prisma.batch.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { id: true, name: true, kind: true, createdAt: true, status: true, error: true, resultJson: true } });
  return rows.map((b) => {
    const r = b.resultJson as unknown as BatchResult | null;
    return { id: b.id, name: b.name, kind: b.kind, createdAt: b.createdAt, status: b.status, error: b.error, exposedCents: r?.exposedCents ?? null, hold: r?.counts.hold ?? null };
  });
}

/** Stored AI readings for some documents of a batch (display only: confidence and source text). */
export async function getDocumentReadings(batchId: string, ids: string[]): Promise<Map<string, ExtractOutcome>> {
  const rows = await prisma.document.findMany({ where: { batchId, id: { in: ids } }, select: { id: true, extractionJson: true } });
  return new Map(rows.map((r) => [r.id, storedOutcome(r.extractionJson)]));
}
