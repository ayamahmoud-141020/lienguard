import { sha256 } from "@/ai/hash";
import type { ExtractOutcome } from "@/ai/extractor";
import { compareDates } from "@/domain/dates";
import { buildSubIssues, type SubIssues } from "@/email/issues";
import type { EmailSender } from "@/email/sender";
import { evaluateBatch, type BatchInput, type BatchResult } from "@/pipeline/evaluate";
import { readDocument } from "@/pipeline/lifecycle";
import { diffDecisions, type DecisionChange } from "./diff";
import { buildDigest, checkDigest } from "./digest";
import { safeToPayText } from "./notify";
import { dueReminders, reminderDraft } from "./reminders";

export type StoredDoc = { id: string; fileName: string; sha256: string; receivedOn: string | null; outcome: ExtractOutcome | null };
export type StoredDraft = { id: string; subCode: string; kind: "followup" | "reminder"; status: string; sentOn: string | null; subject: string; body: string };
export type LoadedBatch = { id: string; name: string; kind: string; status: string; today: string; input: BatchInput; result: BatchResult | null };

/** Persistence the automation needs. Prisma in the app; in memory in tests. */
export interface AutomationStore {
  loadBatch(id: string): Promise<LoadedBatch | null>;
  listReadyBatchIds(): Promise<string[]>;
  listDocuments(batchId: string): Promise<StoredDoc[]>;
  addDocument(batchId: string, d: Omit<StoredDoc, "id"> & { bytes?: Uint8Array }): Promise<{ id: string; duplicate: boolean }>;
  saveResult(batchId: string, today: string, result: BatchResult): Promise<void>;
  listDrafts(batchId: string): Promise<StoredDraft[]>;
  createReminder(batchId: string, sub: SubIssues, subject: string, body: string): Promise<string>;
  event(batchId: string, actor: string, action: string, details?: Record<string, unknown>): Promise<void>;
}

export type Deps = {
  /** Reads one PDF (recorded reading if known, else the live extractor). */
  read: (bytes: Uint8Array, fileName: string) => Promise<ExtractOutcome>;
  sender: EmailSender;
  /** The GC's accounts-payable inbox; notifications and the digest go here, never to a subcontractor. */
  apInbox: string | undefined;
};

const NOT_READ: ExtractOutcome = { ok: false, reason: "not read yet" };

async function mustLoad(store: AutomationStore, id: string): Promise<LoadedBatch> {
  const b = await store.loadBatch(id);
  if (!b) throw new Error("batch not found");
  return b;
}

async function reevaluate(store: AutomationStore, batch: LoadedBatch, today: string): Promise<BatchResult> {
  const docs = await store.listDocuments(batch.id);
  const result = evaluateBatch(batch.input, docs.map((d) => ({ id: d.id, fileName: d.fileName, outcome: d.outcome ?? NOT_READ })), today);
  await store.saveResult(batch.id, today, result);
  return result;
}

/** One event per decision change; HOLD → SAFE also notifies the AP inbox when allowed (AC-18.3/18.4). */
async function recordChanges(store: AutomationStore, deps: Deps, batchId: string, actor: string, changes: DecisionChange[], notify: boolean | "never") {
  for (const c of changes) {
    await store.event(batchId, actor, "payment.status_changed", { paymentId: c.paymentId, sub: c.subName, invoice: c.invoice, from: c.from, to: c.to });
    if (notify === "never" || !(c.from === "HOLD" && c.to === "SAFE")) continue;
    const text = safeToPayText(c);
    if (notify && deps.apInbox) {
      await deps.sender.send({ to: deps.apInbox, subject: text, text: `${text}\n\nAll checks now pass for this payment. Nothing was sent to the subcontractor.`, idempotencyKey: `lienguard-notify/${batchId}/${c.paymentId}/${c.from}-${c.to}` });
      await store.event(batchId, "automation", "notification.sent", { to: "AP inbox", text });
    } else {
      await store.event(batchId, "automation", "notification.not_sent", { text, reason: deps.apInbox ? "demo access locked" : "no AP inbox configured" });
    }
  }
}

/** A document arrives (inbound email or the simulate button): read it, re-check the batch, record what changed (AC-18.2). */
export async function receiveDocument(
  store: AutomationStore,
  deps: Deps,
  i: { batchId: string; fileName: string; bytes: Uint8Array; actor: string; notify: boolean },
): Promise<{ changes: DecisionChange[]; duplicate: boolean; documentId: string | null }> {
  const batch = await mustLoad(store, i.batchId);
  const sha = sha256(i.bytes);
  const existing = (await store.listDocuments(batch.id)).find((d) => d.sha256 === sha);
  if (existing) {
    await store.event(batch.id, i.actor, "document.duplicate", { fileName: i.fileName });
    return { changes: [], duplicate: true, documentId: existing.id };
  }
  const before = batch.result;
  const read = await readDocument(() => deps.read(i.bytes, i.fileName), { documentId: sha, fileName: i.fileName });
  const { id } = await store.addDocument(batch.id, { fileName: i.fileName, sha256: sha, receivedOn: batch.today, outcome: read.outcome, bytes: i.bytes });
  await store.event(batch.id, i.actor, "document.received", { fileName: i.fileName, read: read.status === "done" ? "read" : "needs review" });
  const after = await reevaluate(store, batch, batch.today);
  await store.event(batch.id, "automation", "rules.rerun", { reason: "document received", exposedCents: after.exposedCents });
  const changes = diffDecisions(before, after);
  await recordChanges(store, deps, batch.id, "automation", changes, i.notify);
  return { changes, duplicate: false, documentId: id };
}

export type DailyResult = { batchId: string; name: string; today: string; changes: DecisionChange[]; reminders: string[]; exposedCents: number; waiting: number };

/** The daily check for one batch (AC-19.2, 19.3): new date, rules re-run, reminders drafted. Never moves a batch's date backwards. */
export async function dailyCheck(store: AutomationStore, deps: Deps, i: { batchId: string; today: string; actor: string }): Promise<DailyResult> {
  const batch = await mustLoad(store, i.batchId);
  const today = compareDates(i.today, batch.today) > 0 ? i.today : batch.today;
  const before = batch.result;
  const after = await reevaluate(store, batch, today);
  await store.event(batch.id, i.actor, "rules.rerun", { reason: "daily check", today, exposedCents: after.exposedCents });
  const changes = diffDecisions(before, after);
  await recordChanges(store, deps, batch.id, i.actor, changes, "never");

  const drafts = await store.listDrafts(batch.id);
  const matchedSub = new Map(after.documents.map((d) => [d.id, d.matchedSubCode]));
  const docs = await store.listDocuments(batch.id);
  const due = dueReminders({
    sent: drafts.filter((d) => d.kind === "followup" && d.status === "sent" && d.sentOn).map((d) => ({ subCode: d.subCode, sentOn: d.sentOn as string })),
    received: docs.map((d) => ({ subCode: matchedSub.get(d.id) ?? null, receivedOn: d.receivedOn })),
    reminded: new Set(drafts.filter((d) => d.kind === "reminder").map((d) => d.subCode)),
    today,
  });
  const subs = buildSubIssues(after);
  const created: string[] = [];
  for (const code of due) {
    const sub = subs.find((s) => s.subCode === code);
    if (!sub) continue; // nothing on hold any more: no reminder needed
    const r = reminderDraft(sub);
    await store.createReminder(batch.id, sub, r.subject, r.body);
    await store.event(batch.id, "automation", "reminder.drafted", { sub: sub.subName, needs: "approval" });
    created.push(code);
  }
  const waiting = (await store.listDrafts(batch.id)).filter((d) => d.status === "draft").length;
  return { batchId: batch.id, name: batch.name, today, changes, reminders: created, exposedCents: after.exposedCents, waiting };
}

/** Daily check for several batches, then one digest email to the AP inbox, post-checked against the data (AC-19.4). */
export async function runDaily(
  store: AutomationStore,
  deps: Deps,
  i: { todayFor: (b: LoadedBatch) => string; actor: string; runId: string; batchIds?: string[] },
) {
  const ids = i.batchIds ?? (await store.listReadyBatchIds());
  const results: DailyResult[] = [];
  for (const id of ids) {
    const b = await store.loadBatch(id);
    if (!b) continue;
    results.push(await dailyCheck(store, deps, { batchId: id, today: i.todayFor(b), actor: i.actor }));
  }
  const date = results.map((r) => r.today).sort().at(-1) ?? "";
  const digest = buildDigest({
    date,
    batches: results.map((r) => ({
      name: r.name,
      exposedCents: r.exposedCents,
      newHolds: r.changes.filter((c) => c.to === "HOLD"),
      cleared: r.changes.filter((c) => c.to === "SAFE"),
      waitingDrafts: r.waiting,
    })),
  });
  const check = checkDigest(digest.text, digest.totals);
  let sent = false;
  if (check.ok && deps.apInbox && results.length) {
    await deps.sender.send({ to: deps.apInbox, subject: digest.subject, text: digest.text, idempotencyKey: `lienguard-digest/${i.runId}` });
    sent = true;
    for (const r of results) await store.event(r.batchId, "automation", "digest.sent", { to: "AP inbox", newHolds: digest.totals.newHolds, cleared: digest.totals.cleared });
  }
  return { results, digest, check, sent };
}
