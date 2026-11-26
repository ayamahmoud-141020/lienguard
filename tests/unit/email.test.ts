import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runBatch } from "@/pipeline/run-batch";
import { loadFixtureExtractor, loadSampleBatch } from "@/pipeline/samples";
import { buildSubIssues, buildWriterInput, codeTemplate, type SubIssues } from "@/email/issues";
import { postcheck, fillPlaceholders } from "@/email/postcheck";
import { draftEmail, type EmailWriter } from "@/email/writer";
import { FixtureEmailWriter } from "@/email/fixture-writer";
import { MemoryDraftStore, approveDraft, editDraft, generateDrafts, sendDraft, skipDraft } from "@/email/workflow";
import type { EmailSender } from "@/email/sender";

const today = (JSON.parse(readFileSync("samples/expected.json", "utf8")) as { today: string }).today;
const sample = async () => runBatch(loadSampleBatch("samples"), loadFixtureExtractor("samples"), today);
const subsFor = async () => buildSubIssues(await sample());
const blueLine = async () => (await subsFor()).find((s) => s.subCode === "BLU") as SubIssues;

function fakeSender(fail = false): EmailSender & { calls: { to: string; subject: string; idempotencyKey: string }[] } {
  const calls: { to: string; subject: string; idempotencyKey: string }[] = [];
  return {
    calls,
    async send(m) {
      calls.push({ to: m.to, subject: m.subject, idempotencyKey: m.idempotencyKey });
      if (fail) throw new Error("provider rejected the message");
      return { id: `msg-${calls.length}` };
    },
  };
}

describe("S-10 email drafts", () => {
  it("AC-10.1 one draft per sub with a HOLD, none for all-SAFE subs, no duplicates on re-run", async () => {
    const result = await sample();
    const store = new MemoryDraftStore();
    await generateDrafts("b1", result, new FixtureEmailWriter(), store);
    const holdSubs = new Set(result.payments.filter((p) => p.evaluation.decision === "HOLD").map((p) => p.payment.subCode));
    expect(store.all().map((d) => d.subCode).sort()).toEqual([...holdSubs].sort());
    await generateDrafts("b1", result, new FixtureEmailWriter(), store);
    expect(store.all()).toHaveLength(holdSubs.size);
  });

  it("AC-10.2 the writer input carries placeholders and no digits from amounts or dates", async () => {
    // Granite has R01, R02 and R04 issues, so its input needs both amount and date placeholders.
    const granite = (await subsFor()).find((s) => s.subCode === "GRN") as SubIssues;
    const input = buildWriterInput(granite);
    const json = JSON.stringify(input.forModel);
    expect(json).toContain("{{AMOUNT_1}}");
    expect(json).toContain("{{DATE_1}}");
    for (const v of Object.values(input.tokens)) expect(json).not.toContain(v);
    expect(json).not.toMatch(/\$\s?\d|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/);
    const filled = fillPlaceholders("Pay {{AMOUNT_1}} by {{DATE_1}}", input.tokens);
    expect(filled.ok && filled.text).not.toContain("{{");
  });

  it("AC-10.3 postcheck rejects unknown amounts or dates and accepts known ones", async () => {
    const sub = await blueLine();
    const good = codeTemplate(sub).body;
    expect(postcheck(good, sub).ok).toBe(true);
    expect(postcheck(`${good}\nAlso send $9,999.00.`, sub).problems.join(" ")).toContain("$9,999.00");
    expect(postcheck(`${good}\nBy 2026-12-01 please.`, sub).problems.join(" ")).toContain("2026-12-01");
  });

  it("AC-10.4 postcheck rejects a body that misses an issue", async () => {
    const sub = await blueLine();
    const withoutNotary = codeTemplate(sub).body.split("\n").filter((l) => !/notar/i.test(l)).join("\n");
    const r = postcheck(withoutNotary, sub);
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toMatch(/R06/);
  });

  it("AC-10.5 two failed writer attempts fall back to the code template, which passes the post-check", async () => {
    const sub = await blueLine();
    const bad: EmailWriter = { write: vi.fn(async () => ({ subject: "Docs", bodyTemplate: "Please send $1,000,000.00 today." })) };
    const d = await draftEmail(bad, sub);
    expect(bad.write).toHaveBeenCalledTimes(2);
    expect(d.source).toBe("template");
    expect(postcheck(d.body, sub).ok).toBe(true);
    const good = await draftEmail(new FixtureEmailWriter(), sub);
    expect(good.source).toBe("ai");
    expect(postcheck(good.body, sub).ok).toBe(true);
  });

  it("AC-10.6 only approved drafts send; one call with the idempotency key; a second send is a no-op", async () => {
    const store = new MemoryDraftStore();
    await generateDrafts("b1", await sample(), new FixtureEmailWriter(), store);
    const draft = store.all()[0]!;
    const sender = fakeSender();
    await expect(sendDraft(store, draft.id, "Aya", sender, undefined)).rejects.toThrow(/approved/);
    expect(sender.calls).toHaveLength(0);
    await approveDraft(store, draft.id, "Aya");
    await sendDraft(store, draft.id, "Aya", sender, undefined);
    expect(sender.calls).toEqual([{ to: draft.toAddress, subject: draft.subject, idempotencyKey: `lienguard-draft/${draft.id}` }]);
    expect(store.get(draft.id)?.status).toBe("sent");
    await sendDraft(store, draft.id, "Aya", sender, undefined);
    expect(sender.calls).toHaveLength(1);
  });

  it("AC-10.7 the demo override redirects the email and prefixes the subject", async () => {
    const store = new MemoryDraftStore();
    await generateDrafts("b1", await sample(), new FixtureEmailWriter(), store);
    const draft = store.all()[0]!;
    await approveDraft(store, draft.id, "Aya");
    const sender = fakeSender();
    await sendDraft(store, draft.id, "Aya", sender, "demo@example.test");
    expect(sender.calls[0]?.to).toBe("demo@example.test");
    expect(sender.calls[0]?.subject).toBe(`[DEMO → ${draft.toAddress}] ${draft.subject}`);
  });

  it("AC-10.8 editing in a new amount saves the body and returns a warning, without blocking", async () => {
    const store = new MemoryDraftStore();
    await generateDrafts("b1", await sample(), new FixtureEmailWriter(), store);
    const draft = store.all()[0]!;
    const r = await editDraft(store, draft.id, `${draft.body}\nP.S. a $5.00 fee applies.`, "Aya");
    expect(r.warnings.join(" ")).toContain("$5.00");
    expect(store.get(draft.id)?.body).toContain("$5.00");
    await approveDraft(store, draft.id, "Aya");
    expect(store.get(draft.id)?.status).toBe("approved");
  });

  it("AC-10.9 a send failure marks the draft failed with the error, it can be retried, and every action is audited", async () => {
    const store = new MemoryDraftStore();
    await generateDrafts("b1", await sample(), new FixtureEmailWriter(), store);
    const [a, b] = store.all();
    await approveDraft(store, a!.id, "Aya");
    await expect(sendDraft(store, a!.id, "Aya", fakeSender(true), undefined)).rejects.toThrow(/provider/);
    expect(store.get(a!.id)).toMatchObject({ status: "failed", error: "provider rejected the message" });
    await sendDraft(store, a!.id, "Aya", fakeSender(), undefined);
    expect(store.get(a!.id)?.status).toBe("sent");
    await editDraft(store, b!.id, b!.body + "\nThanks!", "Aya");
    await skipDraft(store, b!.id, "Aya");
    const actions = store.auditLog.map((x) => `${x.action}:${x.entityId === a!.id ? "a" : "b"}:${x.actor}`);
    expect(actions).toEqual(["email.approve:a:Aya", "email.send_failed:a:Aya", "email.send:a:Aya", "email.edit:b:Aya", "email.skip:b:Aya"]);
  });
});
