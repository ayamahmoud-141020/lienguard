import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { MemoryAutomationStore } from "./memory-automation-store";
import { dailyCheck, receiveDocument, type Deps } from "@/automation/engine";
import { recordedOrLive } from "@/automation/reading";
import { activityItem, activitySource } from "@/view/activity";
import { loadRecordedReadings, loadSampleBatch } from "@/pipeline/samples";
import { evaluateBatch } from "@/pipeline/evaluate";
import { sha256 } from "@/ai/hash";
import type { EmailSender } from "@/email/sender";

const TODAY = "2026-11-20";
const recorded = loadRecordedReadings("samples");
const corrected = new Uint8Array(readFileSync("samples/inbound/pdfs/R01-blueline-LKV-oct-corrected.pdf"));
const sender: EmailSender = { send: vi.fn(async () => ({ id: "m1" })) };
const deps: Deps = { read: (bytes, fileName) => recorded.extract({ bytes, fileName }), sender, apInbox: "ap@example.test" };

async function sampleBatch(store: MemoryAutomationStore, tweak?: (input: ReturnType<typeof loadSampleBatch>) => void) {
  const id = "b1";
  const input = loadSampleBatch("samples");
  tweak?.(input);
  for (const f of readdirSync("samples/pdfs").filter((x) => x.endsWith(".pdf")).sort()) {
    const bytes = new Uint8Array(readFileSync(join("samples/pdfs", f)));
    await store.addDocument(id, { fileName: f, sha256: sha256(bytes), receivedOn: TODAY, outcome: await recorded.extract({ bytes, fileName: f }) });
  }
  const docs = await store.listDocuments(id);
  const result = evaluateBatch(input, docs.map((d) => ({ id: d.id, fileName: d.fileName, outcome: d.outcome ?? { ok: false, reason: "x" } })), TODAY);
  store.batches.set(id, { id, name: "Sample batch #1", kind: "sample", status: "ready", today: TODAY, input, result });
  return id;
}

describe("S-18/S-19 gaps from check report 7", () => {
  it("AC-18.2 the received document is stored with the batch's day", async () => {
    const store = new MemoryAutomationStore();
    const id = await sampleBatch(store);
    store.batches.get(id)!.today = "2026-11-24";
    const r = await receiveDocument(store, deps, { batchId: id, fileName: "R01.pdf", bytes: corrected, actor: "automation", notify: false });
    const doc = (await store.listDocuments(id)).find((d) => d.id === r.documentId)!;
    expect(doc.receivedOn).toBe("2026-11-24");
  });

  it("AC-18.2 a recorded reading is used when one exists; otherwise the live extractor reads the PDF", async () => {
    const live = vi.fn(async () => ({ ok: false as const, reason: "live" }));
    const read = recordedOrLive(recorded, live);
    expect((await read(corrected, "R01.pdf")).ok).toBe(true);
    expect(live).not.toHaveBeenCalled();
    const unknown = new TextEncoder().encode("%PDF-1.4 not a sample");
    expect(await read(unknown, "new.pdf")).toEqual({ ok: false, reason: "live" });
    expect(live).toHaveBeenCalledWith(unknown, "new.pdf");
  });

  it("AC-19.1 the daily check never moves a batch's date backwards", async () => {
    const store = new MemoryAutomationStore();
    const id = await sampleBatch(store);
    store.batches.get(id)!.today = "2026-11-25";
    const r = await dailyCheck(store, deps, { batchId: id, today: "2026-11-21", actor: "automation" });
    expect(r.today).toBe("2026-11-25");
    expect(store.batches.get(id)!.today).toBe("2026-11-25");
  });

  it("AC-19.2 a conditional waiver past the grace period becomes R03 HOLD on the daily check", async () => {
    const store = new MemoryAutomationStore();
    // PAY-05 has a conditional waiver and is unpaid (SAFE). Say it was paid today: still SAFE within the 5-day grace.
    const id = await sampleBatch(store, (input) => {
      const p = input.payments.find((x) => x.id === "PAY-05")!;
      p.paidDate = TODAY;
    });
    const before = store.batches.get(id)!.result!.payments.find((p) => p.payment.id === "PAY-05")!;
    expect(before.evaluation.decision).toBe("SAFE");
    const r = await dailyCheck(store, deps, { batchId: id, today: "2026-11-26", actor: "automation" });
    const after = store.batches.get(id)!.result!.payments.find((p) => p.payment.id === "PAY-05")!;
    expect(after.evaluation.decision).toBe("HOLD");
    expect(after.evaluation.findings.map((f) => f.ruleId)).toContain("R03");
    expect(r.changes).toContainEqual(expect.objectContaining({ paymentId: "PAY-05", from: "SAFE", to: "HOLD" }));
  });
});

describe("S-20 activity timeline", () => {
  it("AC-20.1 each automatic event reads as a plain sentence, with its source", () => {
    expect(activitySource("automation")).toBe("Automation");
    expect(activitySource("Aya")).toBe("Aya");
    expect(activityItem("document.received", { fileName: "R01.pdf", read: "read" }, null).text).toBe("Document received: R01.pdf (read)");
    expect(activityItem("rules.rerun", { reason: "daily check", today: "2026-11-23", exposedCents: 16_050_000 }, null).text).toBe(
      "Rules re-run (daily check, batch date November 23, 2026). Exposed $160,500.00.",
    );
    const flip = activityItem("payment.status_changed", { sub: "BlueLine Plumbing", invoice: "BLP-2201", from: "HOLD", to: "SAFE" }, null);
    expect(flip).toMatchObject({ text: "BlueLine Plumbing, invoice BLP-2201: HOLD → SAFE", tone: "safe" });
    expect(activityItem("reminder.drafted", { sub: "Granite Drywall & Paint" }, null).text).toBe("Reminder drafted for Granite Drywall & Paint. Waiting for a person to approve it.");
    expect(activityItem("digest.sent", { newHolds: 1, cleared: 2 }, null).text).toBe("Daily digest sent to the AP inbox (1 new holds, 2 cleared).");
    expect(activityItem("notification.sent", { text: "X is now safe to pay" }, null).text).toBe("Notified the AP inbox: “X is now safe to pay”");
    expect(activityItem("notification.not_sent", { text: "X", reason: "demo access locked" }, null).text).toBe("AP notification not sent (demo access locked): “X”");
  });
});

