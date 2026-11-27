import { readFileSync } from "node:fs";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { loadEnv } from "@/env";
import { cachedExtract } from "@/ai/cache";
import { toDocument } from "@/ai/to-document";
import type { AutomationStore, Deps } from "@/automation/engine";
import { recordedOrLive } from "@/automation/reading";
import { groundedRead } from "@/ai/grounded-extractor";
import type { BatchInput, BatchResult } from "@/pipeline/evaluate";
import { loadRecordedReadings } from "@/pipeline/samples";
import { SAMPLES_DIR, dbCache, getExtractor, storedOutcome } from "./batches";
import { getSender } from "./drafts";

const json = (v: unknown) => v as Prisma.InputJsonValue;

/** The automation's view of the database. Events go to the audit log, which is the activity timeline (S-20). */
export const prismaAutomationStore: AutomationStore = {
  async loadBatch(id) {
    const b = await prisma.batch.findUnique({ where: { id } });
    if (!b) return null;
    return { id: b.id, name: b.name, kind: b.kind, status: b.status, today: b.today, input: b.inputJson as unknown as BatchInput, result: (b.resultJson as unknown as BatchResult | null) ?? null };
  },
  async listReadyBatchIds() {
    return (await prisma.batch.findMany({ where: { status: "ready" }, select: { id: true }, orderBy: { createdAt: "asc" } })).map((b) => b.id);
  },
  async listDocuments(batchId) {
    const rows = await prisma.document.findMany({ where: { batchId }, orderBy: { fileName: "asc" }, select: { id: true, fileName: true, sha256: true, receivedOn: true, extractionJson: true } });
    return rows.map((r) => ({ id: r.id, fileName: r.fileName, sha256: r.sha256, receivedOn: r.receivedOn, outcome: r.extractionJson === null ? null : storedOutcome(r.extractionJson) }));
  },
  async addDocument(batchId, d) {
    const found = await prisma.document.findUnique({ where: { batchId_sha256: { batchId, sha256: d.sha256 } }, select: { id: true } });
    if (found) return { id: found.id, duplicate: true };
    const review = !d.outcome || !d.outcome.ok || toDocument(d.outcome.extraction, { documentId: d.sha256, fileName: d.fileName }).needsReview;
    const row = await prisma.document.create({
      data: {
        batchId,
        fileName: d.fileName,
        sha256: d.sha256,
        bytes: Buffer.from(d.bytes ?? new Uint8Array()),
        receivedOn: d.receivedOn,
        status: d.outcome ? (review ? "needs_review" : "done") : "queued",
        ...(d.outcome ? { extractionJson: json(d.outcome) } : {}),
      },
      select: { id: true },
    });
    return { id: row.id, duplicate: false };
  },
  async saveResult(batchId, today, result) {
    await prisma.batch.update({ where: { id: batchId }, data: { today, resultJson: json(result), status: "ready", error: null } });
  },
  async listDrafts(batchId) {
    const rows = await prisma.emailDraft.findMany({ where: { batchId }, select: { id: true, subCode: true, kind: true, status: true, sentOn: true, subject: true, body: true } });
    return rows.map((r) => ({ ...r, kind: r.kind === "reminder" ? ("reminder" as const) : ("followup" as const) }));
  },
  async createReminder(batchId, sub, subject, body) {
    const row = await prisma.emailDraft.upsert({
      where: { batchId_subCode_kind: { batchId, subCode: sub.subCode, kind: "reminder" } },
      create: { batchId, subCode: sub.subCode, kind: "reminder", toAddress: sub.email, subject, body, source: "template", status: "draft", issuesJson: json(sub) },
      update: {},
      select: { id: true },
    });
    return row.id;
  },
  async event(batchId, actor, action, details) {
    await prisma.auditLog.create({ data: { actor, action, entityType: "Batch", entityId: batchId, detailsJson: details ? json(details) : undefined } });
  },
};

const recorded = loadRecordedReadings(SAMPLES_DIR);

/** Recorded reading when the PDF is one of the fictional samples; otherwise the live extractor (cached by hash). */
export function automationDeps(): Deps {
  const env = loadEnv();
  return {
    // Every reading, recorded or live (after the cache), is checked against the PDF text (R-23).
    read: groundedRead(recordedOrLive(recorded, (bytes, fileName) => cachedExtract(getExtractor(), dbCache, { bytes, fileName }))),
    sender: getSender(),
    apInbox: env.AP_INBOX ?? env.DEMO_EMAIL_OVERRIDE,
  };
}

/** The sample "subcontractor reply": BlueLine's corrected waiver (samples/inbound). */
export const SAMPLE_REPLY = { fileName: "R01-blueline-LKV-oct-corrected.pdf", bytes: () => new Uint8Array(readFileSync(join(SAMPLES_DIR, "inbound", "pdfs", "R01-blueline-LKV-oct-corrected.pdf"))) };

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** AC-18.1: the inbound endpoint needs x-inbound-secret = INBOUND_SECRET (never open when the secret is unset). */
export function requireInboundSecret(req: Request, env: Record<string, string | undefined> = process.env): Response | null {
  const expected = env.INBOUND_SECRET;
  const given = req.headers.get("x-inbound-secret") ?? "";
  return expected && same(given, expected) ? null : Response.json({ error: "Wrong or missing inbound secret" }, { status: 401 });
}

/** AC-19.1: Vercel Cron sends Authorization: Bearer <CRON_SECRET>. */
export function requireCronSecret(req: Request, env: Record<string, string | undefined> = process.env): Response | null {
  const expected = env.CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  return expected && same(given, `Bearer ${expected}`) ? null : Response.json({ error: "Unauthorized" }, { status: 401 });
}
