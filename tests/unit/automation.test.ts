import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { MemoryAutomationStore } from "./memory-automation-store";
import { dailyCheck, receiveDocument, runDaily, type Deps } from "@/automation/engine";
import { buildDigest, checkDigest } from "@/automation/digest";
import { dueReminders, reminderDraft } from "@/automation/reminders";
import { safeToPayText } from "@/automation/notify";
import { loadRecordedReadings, loadSampleBatch } from "@/pipeline/samples";
import { evaluateBatch } from "@/pipeline/evaluate";
import { sha256 } from "@/ai/hash";
import { buildSubIssues, type SubIssues } from "@/email/issues";
import { postcheck } from "@/email/postcheck";
import { addDays } from "@/domain/dates";
import type { EmailSender } from "@/email/sender";

const TODAY = "2026-11-20";
const recorded = loadRecordedReadings("samples");
const corrected = new Uint8Array(readFileSync("samples/inbound/pdfs/R01-blueline-LKV-oct-corrected.pdf"));

function fakeSender() {
  const sent: { to: string; subject: string; text: string; idempotencyKey: string }[] = [];
  const sender: EmailSender = { send: vi.fn(async (m) => (sent.push(m), { id: `m${sent.length}` })) };
  return { sender, sent };
}

/** A ready sample batch in the memory store, exactly as createSampleBatch would leave it. */
async function sampleBatch(store: MemoryAutomationStore, id = "b1") {
  const input = loadSampleBatch("samples");
  const files = readdirSync("samples/pdfs").filter((f) => f.endsWith(".pdf")).sort();
  for (const f of files) {
    const bytes = new Uint8Array(readFileSync(join("samples/pdfs", f)));
    await store.addDocument(id, { fileName: f, sha256: sha256(bytes), receivedOn: TODAY, outcome: await recorded.extract({ bytes, fileName: f }) });
  }
  const docs = await store.listDocuments(id);
  const result = evaluateBatch(input, docs.map((d) => ({ id: d.id, fileName: d.fileName, outcome: d.outcome ?? { ok: false, reason: "not read" } })), TODAY);
  store.batches.set(id, { id, name: "Sample batch #1", kind: "sample", status: "ready", today: TODAY, input, result });
  return id;
}

const deps = (sender: EmailSender): Deps => ({ read: (bytes, fileName) => recorded.extract({ bytes, fileName }), sender, apInbox: "ap@example.test" });

describe("S-18 inbound documents", () => {
  it("AC-18.2/18.3 a corrected waiver flips PAY-02 HOLD → SAFE, records the change and notifies the AP inbox once", async () => {
    const store = new MemoryAutomationStore();
    const id = await sampleBatch(store);
    const before = store.batches.get(id)!.result!.payments.find((p) => p.payment.id === "PAY-02")!;
    expect(before.evaluation.decision).toBe("HOLD");
    const { sender, sent } = fakeSender();

    const r = await receiveDocument(store, deps(sender), { batchId: id, fileName: "R01.pdf", bytes: corrected, actor: "automation", notify: true });
    expect(r.changes).toEqual([{ paymentId: "PAY-02", subCode: "BLU", subName: "BlueLine Plumbing", invoice: "BLP-2201", amountCents: 2_000_000, from: "HOLD", to: "SAFE" }]);
    const after = store.batches.get(id)!.result!.payments.find((p) => p.payment.id === "PAY-02")!;
    expect(after.evaluation.decision).toBe("SAFE");
    expect(store.batches.get(id)!.result!.exposedCents).toBe(16_050_000);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("ap@example.test");
    expect(sent[0]!.idempotencyKey).toBe(`lienguard-notify/${id}/PAY-02/HOLD-SAFE`);
    expect(sent[0]!.text).toContain(safeToPayText(r.changes[0]!));
    expect(safeToPayText(r.changes[0]!)).toBe("BlueLine Plumbing is now safe to pay: BLP-2201, $20,000.00");
    expect(store.events.map((e) => e.action)).toEqual(["document.received", "rules.rerun", "payment.status_changed", "notification.sent"]);
    expect(store.events.every((e) => e.actor === "automation")).toBe(true);

    // The same PDF again: stored once, nothing changes, no second email.
    const again = await receiveDocument(store, deps(sender), { batchId: id, fileName: "R01.pdf", bytes: corrected, actor: "automation", notify: true });
    expect(again.changes).toEqual([]);
    expect(again.duplicate).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it("AC-18.4 without notify (locked demo) the flip is recorded but no email is sent", async () => {
    const store = new MemoryAutomationStore();
    const id = await sampleBatch(store);
    const { sender, sent } = fakeSender();
    const r = await receiveDocument(store, deps(sender), { batchId: id, fileName: "R01.pdf", bytes: corrected, actor: "Visitor", notify: false });
    expect(r.changes).toHaveLength(1);
    expect(sent).toHaveLength(0);
    expect(store.events.map((e) => e.action)).toContain("notification.not_sent");
  });
});

describe("S-19 daily automation", () => {
  it("AC-19.2 an unpaid payment's insurance is checked against today: an expired COI turns it into R09 HOLD", async () => {
    const store = new MemoryAutomationStore();
    const id = await sampleBatch(store);
    // PAY-05 (Brightway, unpaid, SAFE) depends on Brightway's COI (C03); move the date past its expiry.
    const c03 = (await store.listDocuments(id)).find((d) => d.fileName === "C03-brightway.pdf")!;
    const raw = c03.outcome?.ok ? String(c03.outcome.extraction.coi?.glExpiry.value) : "";
    const { parseDate } = await import("@/domain/dates");
    const exp = parseDate(raw);
    if (!exp.ok) throw new Error("fixture expiry did not parse");
    const { sender } = fakeSender();
    expect(store.batches.get(id)!.result!.payments.find((p) => p.payment.id === "PAY-05")!.evaluation.decision).toBe("SAFE");

    const r = await dailyCheck(store, deps(sender), { batchId: id, today: addDays(exp.date, 1), actor: "automation" });
    const pay05 = store.batches.get(id)!.result!.payments.find((p) => p.payment.id === "PAY-05")!;
    expect(pay05.evaluation.decision).toBe("HOLD");
    expect(pay05.evaluation.findings.map((f) => f.ruleId)).toContain("R09");
    expect(r.changes).toContainEqual(expect.objectContaining({ paymentId: "PAY-05", from: "SAFE", to: "HOLD" }));
    expect(store.events.map((e) => e.action)).toContain("payment.status_changed");
  });

  it("AC-19.3 a reminder draft is created 3 days after a sent email with no new document, once, and it passes the post-check", async () => {
    expect(dueReminders({ sent: [{ subCode: "BLU", sentOn: "2026-11-20" }], received: [], reminded: new Set(), today: "2026-11-22" })).toEqual([]);
    expect(dueReminders({ sent: [{ subCode: "BLU", sentOn: "2026-11-20" }], received: [], reminded: new Set(), today: "2026-11-23" })).toEqual(["BLU"]);
    expect(dueReminders({ sent: [{ subCode: "BLU", sentOn: "2026-11-20" }], received: [{ subCode: "BLU", receivedOn: "2026-11-21" }], reminded: new Set(), today: "2026-11-25" })).toEqual([]);
    expect(dueReminders({ sent: [{ subCode: "BLU", sentOn: "2026-11-20" }], received: [], reminded: new Set(["BLU"]), today: "2026-11-25" })).toEqual([]);

    const store = new MemoryAutomationStore();
    const id = await sampleBatch(store);
    store.drafts.push({ id: "f1", batchId: id, subCode: "GRN", kind: "followup", status: "sent", sentOn: TODAY, subject: "s", body: "b" });
    const { sender, sent } = fakeSender();
    for (const day of [1, 2]) expect((await dailyCheck(store, deps(sender), { batchId: id, today: addDays(TODAY, day), actor: "automation" })).reminders).toEqual([]);
    const r3 = await dailyCheck(store, deps(sender), { batchId: id, today: addDays(TODAY, 3), actor: "automation" });
    expect(r3.reminders).toEqual(["GRN"]);
    const r4 = await dailyCheck(store, deps(sender), { batchId: id, today: addDays(TODAY, 4), actor: "automation" });
    expect(r4.reminders).toEqual([]);
    const reminder = store.drafts.find((d) => d.kind === "reminder")!;
    expect(reminder.status).toBe("draft");
    expect(sent).toHaveLength(0);
    const sub = buildSubIssues(store.batches.get(id)!.result!).find((s) => s.subCode === "GRN") as SubIssues;
    expect(postcheck(`${reminder.subject}\n${reminder.body}`, sub).ok).toBe(true);
    expect(reminderDraft(sub).subject).toMatch(/^Reminder: /);
    expect(store.events.map((e) => e.action)).toContain("reminder.drafted");
  });

  it("AC-19.4 the digest's numbers come from the data and are checked before sending", async () => {
    const store = new MemoryAutomationStore();
    const id = await sampleBatch(store);
    await receiveDocument(store, deps(fakeSender().sender), { batchId: id, fileName: "R01.pdf", bytes: corrected, actor: "automation", notify: false });
    store.drafts.push({ id: "f1", batchId: id, subCode: "GRN", kind: "followup", status: "draft", sentOn: null, subject: "s", body: "b" });
    const { sender, sent } = fakeSender();

    const run = await runDaily(store, deps(sender), { todayFor: (b) => addDays(b.today, 1), actor: "automation", runId: "r1" });
    expect(sent).toHaveLength(1);
    const totals = run.digest.totals;
    expect(totals.exposedCents).toBe(store.batches.get(id)!.result!.exposedCents);
    expect(totals.waiting).toBe(1);
    expect(checkDigest(sent[0]!.text, totals)).toEqual({ ok: true, problems: [] });
    expect(sent[0]!.text).toContain(`Exposed: $${(totals.exposedCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
    expect(checkDigest(sent[0]!.text.replace(/New holds: \d+/, "New holds: 99"), totals).ok).toBe(false);

    const d = buildDigest({ date: "2026-11-21", batches: [{ name: "B", exposedCents: 100, newHolds: [], cleared: [], waitingDrafts: 2 }] });
    expect(d.totals).toEqual({ newHolds: 0, cleared: 0, exposedCents: 100, waiting: 2 });
    expect(store.events.map((e) => e.action)).toContain("digest.sent");
  });
});
