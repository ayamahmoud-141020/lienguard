import { GeminiEmailWriter } from "@/email/gemini-writer";
import type { Prisma, EmailDraft } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { loadEnv } from "@/env";
import { AnthropicEmailWriter } from "@/email/anthropic-writer";
import { FixtureEmailWriter } from "@/email/fixture-writer";
import { FakeSender, ResendSender, type EmailSender } from "@/email/sender";
import type { DraftStore, DraftStatus, EmailDraftRecord, NewDraft } from "@/email/workflow";
import type { EmailWriter } from "@/email/writer";
import type { SubIssues } from "@/email/issues";

export function getWriter(): EmailWriter {
  const env = loadEnv();
  if (env.LIENGUARD_AI === "fixture") return new FixtureEmailWriter();
  if (env.LIENGUARD_AI === "gemini") return GeminiEmailWriter.fromApiKey(env.GEMINI_API_KEY ?? "", env.GEMINI_MODEL, env.GEMINI_MAX_CONCURRENCY);
  return new AnthropicEmailWriter(env.ANTHROPIC_API_KEY ?? "", env.ANTHROPIC_MODEL);
}

export function getSender(): EmailSender {
  const env = loadEnv();
  return env.LIENGUARD_EMAIL === "fake" ? new FakeSender() : new ResendSender(env.RESEND_API_KEY ?? "", env.EMAIL_FROM);
}

function toRecord(d: EmailDraft): EmailDraftRecord {
  return {
    id: d.id,
    batchId: d.batchId,
    subCode: d.subCode,
    toAddress: d.toAddress,
    subject: d.subject,
    body: d.body,
    issues: d.issuesJson as unknown as SubIssues,
    status: d.status as DraftStatus,
    source: d.source === "ai" ? "ai" : "template",
    approvedBy: d.approvedBy,
    approvedAt: d.approvedAt?.toISOString() ?? null,
    sentAt: d.sentAt?.toISOString() ?? null,
    providerMessageId: d.providerMessageId,
    error: d.error,
    kind: d.kind === "reminder" ? "reminder" : "followup",
  };
}

export const prismaDraftStore: DraftStore = {
  async exists(batchId, subCode) {
    return (await prisma.emailDraft.count({ where: { batchId, subCode, kind: "followup" } })) > 0;
  },
  async create(d: NewDraft) {
    const row = await prisma.emailDraft.create({
      data: { batchId: d.batchId, subCode: d.subCode, toAddress: d.toAddress, subject: d.subject, body: d.body, source: d.source, issuesJson: d.issues as unknown as Prisma.InputJsonValue },
    });
    return toRecord(row);
  },
  async load(id) {
    const row = await prisma.emailDraft.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  },
  async update(id, patch) {
    const data: Prisma.EmailDraftUpdateInput = {};
    if (patch.subject !== undefined) data.subject = patch.subject;
    if (patch.body !== undefined) data.body = patch.body;
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.approvedBy !== undefined) data.approvedBy = patch.approvedBy;
    if (patch.approvedAt !== undefined) data.approvedAt = patch.approvedAt ? new Date(patch.approvedAt) : null;
    if (patch.sentAt !== undefined) data.sentAt = patch.sentAt ? new Date(patch.sentAt) : null;
    if (patch.status === "sent") {
      // Remember the batch day it went out, so the daily check can draft a reminder 3 days later (S-19).
      const row = await prisma.emailDraft.findUnique({ where: { id }, select: { batch: { select: { today: true } } } });
      if (row) data.sentOn = row.batch.today;
    }
    if (patch.providerMessageId !== undefined) data.providerMessageId = patch.providerMessageId;
    if (patch.error !== undefined) data.error = patch.error;
    return toRecord(await prisma.emailDraft.update({ where: { id }, data }));
  },
  async audit(actor, action, draftId, details) {
    await prisma.auditLog.create({ data: { actor, action, entityType: "EmailDraft", entityId: draftId, detailsJson: details } });
  },
};

export async function listDrafts(batchId: string): Promise<EmailDraftRecord[]> {
  const rows = await prisma.emailDraft.findMany({ where: { batchId }, orderBy: [{ subCode: "asc" }, { kind: "asc" }] });
  return rows.map(toRecord);
}

export async function listAudit(batchId: string) {
  const draftIds = (await prisma.emailDraft.findMany({ where: { batchId }, select: { id: true, subCode: true } }));
  const subByDraft = new Map(draftIds.map((d) => [d.id, d.subCode]));
  const rows = await prisma.auditLog.findMany({
    where: { OR: [{ entityType: "Batch", entityId: batchId }, { entityType: "EmailDraft", entityId: { in: draftIds.map((d) => d.id) } }] },
    orderBy: { at: "desc" },
    take: 200,
  });
  return rows.map((r) => ({ ...r, subCode: subByDraft.get(r.entityId) ?? null }));
}
