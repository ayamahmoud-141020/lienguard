import type { BatchResult } from "@/pipeline/evaluate";
import { buildSubIssues, type SubIssues } from "./issues";
import { postcheck } from "./postcheck";
import { draftEmail, type EmailWriter } from "./writer";
import type { EmailSender } from "./sender";

export type DraftStatus = "draft" | "approved" | "skipped" | "sent" | "failed";

export type EmailDraftRecord = {
  id: string;
  batchId: string;
  subCode: string;
  toAddress: string;
  subject: string;
  body: string;
  issues: SubIssues;
  status: DraftStatus;
  source: "ai" | "template";
  approvedBy: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  providerMessageId: string | null;
  error: string | null;
  /** followup (from "Draft follow-up emails") or reminder (drafted by the daily check). Defaults to followup. */
  kind?: "followup" | "reminder";
};

export type NewDraft = Pick<EmailDraftRecord, "batchId" | "subCode" | "toAddress" | "subject" | "body" | "issues" | "source">;

export interface DraftStore {
  exists(batchId: string, subCode: string): Promise<boolean>;
  create(d: NewDraft): Promise<EmailDraftRecord>;
  load(id: string): Promise<EmailDraftRecord | null>;
  update(id: string, patch: Partial<EmailDraftRecord>): Promise<EmailDraftRecord>;
  audit(actor: string, action: string, draftId: string, details?: Record<string, string | number | boolean>): Promise<void>;
}

/** One draft per sub with at least one HOLD. Existing drafts are kept (idempotent). */
export async function generateDrafts(batchId: string, result: BatchResult, writer: EmailWriter, store: DraftStore): Promise<number> {
  let created = 0;
  for (const sub of buildSubIssues(result)) {
    if (await store.exists(batchId, sub.subCode)) continue;
    const d = await draftEmail(writer, sub);
    await store.create({ batchId, subCode: sub.subCode, toAddress: sub.email, subject: d.subject, body: d.body, issues: sub, source: d.source });
    created++;
  }
  return created;
}

async function mustLoad(store: DraftStore, id: string): Promise<EmailDraftRecord> {
  const d = await store.load(id);
  if (!d) throw new Error("draft not found");
  return d;
}

export async function approveDraft(store: DraftStore, id: string, actor: string): Promise<void> {
  const d = await mustLoad(store, id);
  if (d.status === "sent") throw new Error("already sent");
  await store.update(id, { status: "approved", approvedBy: actor, approvedAt: new Date().toISOString() });
  await store.audit(actor, "email.approve", id);
}

export async function skipDraft(store: DraftStore, id: string, actor: string): Promise<void> {
  const d = await mustLoad(store, id);
  if (d.status === "sent") throw new Error("already sent");
  await store.update(id, { status: "skipped" });
  await store.audit(actor, "email.skip", id);
}

/** Saves the edit and re-runs the post-check as warnings (a person may add numbers on purpose). Needs re-approval. */
export async function editDraft(store: DraftStore, id: string, body: string, actor: string, subject?: string): Promise<{ warnings: string[] }> {
  const d = await mustLoad(store, id);
  if (d.status === "sent") throw new Error("already sent");
  const nextSubject = subject ?? d.subject;
  const warnings = postcheck(`${nextSubject}\n${body}`, d.issues).problems;
  await store.update(id, { body, subject: nextSubject, status: "draft", approvedBy: null, approvedAt: null });
  await store.audit(actor, "email.edit", id, { warnings: warnings.length });
  return { warnings };
}

/** Sends an approved (or previously failed) draft once. Idempotency key = draft id. */
export async function sendDraft(store: DraftStore, id: string, actor: string, sender: EmailSender, demoOverride: string | undefined): Promise<void> {
  const d = await mustLoad(store, id);
  if (d.status === "sent") return;
  if (d.status !== "approved" && d.status !== "failed") throw new Error("Only approved drafts can be sent");
  if (d.status === "failed" && !d.approvedBy) throw new Error("Only approved drafts can be sent");
  const to = demoOverride || d.toAddress;
  const subject = demoOverride ? `[DEMO → ${d.toAddress}] ${d.subject}` : d.subject;
  try {
    const { id: messageId } = await sender.send({ to, subject, text: d.body, idempotencyKey: `lienguard-draft/${d.id}` });
    await store.update(id, { status: "sent", sentAt: new Date().toISOString(), providerMessageId: messageId, error: null });
    await store.audit(actor, "email.send", id, { to });
  } catch (e) {
    const error = e instanceof Error ? e.message.slice(0, 300) : "send failed";
    await store.update(id, { status: "failed", error });
    await store.audit(actor, "email.send_failed", id, { error });
    throw e;
  }
}

/** In-memory store for tests. */
export class MemoryDraftStore implements DraftStore {
  private drafts = new Map<string, EmailDraftRecord>();
  auditLog: { actor: string; action: string; entityId: string }[] = [];
  private seq = 0;

  all(): EmailDraftRecord[] {
    return [...this.drafts.values()];
  }
  get(id: string): EmailDraftRecord | undefined {
    return this.drafts.get(id);
  }
  async exists(batchId: string, subCode: string) {
    return this.all().some((d) => d.batchId === batchId && d.subCode === subCode);
  }
  async create(d: NewDraft) {
    const rec: EmailDraftRecord = { ...d, id: `d${++this.seq}`, status: "draft", approvedBy: null, approvedAt: null, sentAt: null, providerMessageId: null, error: null };
    this.drafts.set(rec.id, rec);
    return rec;
  }
  async load(id: string) {
    return this.drafts.get(id) ?? null;
  }
  async update(id: string, patch: Partial<EmailDraftRecord>) {
    const next = { ...(this.drafts.get(id) as EmailDraftRecord), ...patch };
    this.drafts.set(id, next);
    return next;
  }
  async audit(actor: string, action: string, draftId: string) {
    this.auditLog.push({ actor, action, entityId: draftId });
  }
}
