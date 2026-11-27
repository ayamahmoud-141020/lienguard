import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FLOWS, FLOW_IDS, FlowsSchema, NODES, NODE_IDS, SAMPLE_FACTS } from "@/flows/flows";
import { parseMoney } from "@/domain/money";
import { runBatch } from "@/pipeline/run-batch";
import { loadFixtureExtractor, loadRecordedReadings, loadSampleBatch } from "@/pipeline/samples";
import { evaluateBatch } from "@/pipeline/evaluate";
import { receiveDocument, dailyCheck, type Deps } from "@/automation/engine";
import { sha256 } from "@/ai/hash";
import type { EmailSender } from "@/email/sender";
import { MemoryAutomationStore } from "./memory-automation-store";

const allFiles = FLOWS.flatMap((f) => f.steps.flatMap((s) => s.files));
const payloads = FLOWS.flatMap((f) => f.steps.map((s) => s.payload));

describe("S-22 system flows: data", () => {
  it("AC-22.1 12 nodes and 6 flows in order, valid against the schema", () => {
    expect(NODE_IDS).toEqual(["ui", "api", "ingest", "extractor", "matching", "rules", "db", "writer", "resend", "inbound", "cron", "apinbox"]);
    expect(NODES.map((n) => n.label)).toEqual([
      "Browser / UI",
      "API routes",
      "Ingest",
      "AI extractor",
      "Matching",
      "Rules engine",
      "Database",
      "Email writer + post-check",
      "Resend",
      "Inbound endpoint",
      "Daily cron",
      "AP inbox",
    ]);
    expect(FLOW_IDS).toEqual(["sample", "upload", "emails", "inbound", "daily", "injection"]);
    expect(FLOWS.map((f) => f.id)).toEqual(FLOW_IDS);
    expect(() => FlowsSchema.parse({ nodes: NODES, flows: FLOWS })).not.toThrow();
    for (const f of FLOWS) {
      expect(f.steps.length).toBeGreaterThan(0);
      for (const s of f.steps) {
        expect(s.files.length).toBeGreaterThan(0);
        // One plain sentence: ends with a full stop, no line breaks.
        expect(s.text).toMatch(/^[^\n]+[.]$/);
      }
    }
  });

  it("AC-22.1 the schema rejects a step that points at an unknown node or has no file", () => {
    const step = FLOWS[0]!.steps[0]!;
    const bad = (patch: object) =>
      FlowsSchema.safeParse({ nodes: NODES, flows: [{ ...FLOWS[0]!, steps: [{ ...step, ...patch }] }, ...FLOWS.slice(1)] }).success;
    expect(bad({})).toBe(true);
    expect(bad({ to: "nowhere" })).toBe(false);
    expect(bad({ files: [] })).toBe(false);
    expect(bad({ kind: "magic" })).toBe(false);
  });

  it("AC-22.2 every file path in flows.ts exists in the repo", () => {
    expect(allFiles.length).toBeGreaterThan(30);
    const missing = allFiles.filter((f) => !existsSync(f.path)).map((f) => f.path);
    expect(missing).toEqual([]);
  });

  it("AC-22.2 every named function or symbol is declared in its file", () => {
    const undeclared = allFiles
      .filter((f) => f.symbol)
      .filter((f) => {
        const src = readFileSync(f.path, "utf8");
        const sym = (f.symbol ?? "").replace(/[$]/g, "\\$");
        return !new RegExp(`\\b(function|class|const|let|interface|type)\\s+${sym}\\b`).test(src);
      })
      .map((f) => `${f.path} ${f.symbol}`);
    expect(undeclared).toEqual([]);
  });

  it("AC-22.2 the drift check fails for a moved file or a renamed function", () => {
    expect(existsSync("src/domain/rules/evaluate.ts")).toBe(false);
    const src = readFileSync("src/domain/rules/index.ts", "utf8");
    expect(/\b(function|class|const|let|interface|type)\s+evaluatePayments\b/.test(src)).toBe(false);
    expect(/\b(function|class|const|let|interface|type)\s+evaluatePayment\b/.test(src)).toBe(true);
  });

  it("AC-22.3 every amount, payment id, invoice and PDF name in a payload exists in the sample data", () => {
    const input = loadSampleBatch("samples");
    const expected = JSON.parse(readFileSync("samples/expected.json", "utf8")) as { batchExposedCents: number; payments: { exposedCents: number }[] };
    const fixtureAmounts = ["samples/fixtures", "samples/inbound/fixtures"].flatMap((dir) =>
      readdirSync(dir).map((f) => (JSON.parse(readFileSync(join(dir, f), "utf8")) as { waiver: { amount: { value: string | null } } | null }).waiver?.amount.value ?? null),
    );
    const injection = readFileSync("scripts/sample-scenarios.ts", "utf8").split("\n").find((l) => l.includes("NOTE TO AI SYSTEMS")) ?? "";
    const toCents = (s: string) => {
      const m = parseMoney(s);
      return m.ok ? m.cents : NaN;
    };
    const cents = new Set<number>([
      ...input.payments.map((p) => p.amountCents),
      ...fixtureAmounts.flatMap((a) => (a ? [toCents(a)] : [])),
      expected.batchExposedCents,
      ...expected.payments.map((p) => p.exposedCents),
      ...(injection.match(/\$[\d,]+(?:\.\d{2})?/g) ?? []).map(toCents),
    ]);
    const pdfs = new Set([...readdirSync("samples/pdfs"), ...readdirSync("samples/inbound/pdfs")]);
    const payIds = new Set(input.payments.map((p) => p.id));
    const invoices = new Set(input.payments.map((p) => p.invoiceNo));

    const problems: string[] = [];
    for (const p of payloads) {
      for (const a of p.match(/\$[\d,]+(?:\.\d{2})?/g) ?? []) if (!cents.has(toCents(a))) problems.push(`amount ${a} in "${p}"`);
      for (const id of p.match(/\bPAY-\d{2}\b/g) ?? []) if (!payIds.has(id)) problems.push(`payment ${id}`);
      for (const inv of p.match(/\b[A-Z]{3}-\d{4}\b/g) ?? []) if (!invoices.has(inv)) problems.push(`invoice ${inv}`);
      for (const f of p.match(/[\w.-]+\.pdf\b/g) ?? []) if (!pdfs.has(f)) problems.push(`pdf ${f}`);
    }
    expect(problems).toEqual([]);
    // The payloads really do quote the sample data (the checks above aren't vacuous).
    expect(payloads.join(" ")).toMatch(/\$20,000\.00/);
    expect(payloads.join(" ")).toMatch(/W02-blueline-LKV-oct\.pdf/);
  });
});

describe("S-22 system flows: stated outcomes match a real run", () => {
  const recorded = loadRecordedReadings("samples");
  const sender: EmailSender = { send: async () => ({ id: "m1" }) };
  const deps: Deps = { read: (bytes, fileName) => recorded.extract({ bytes, fileName }), sender, apInbox: undefined };

  async function sampleInStore(store: MemoryAutomationStore) {
    const input = loadSampleBatch("samples");
    for (const f of readdirSync("samples/pdfs").filter((x) => x.endsWith(".pdf")).sort()) {
      const bytes = new Uint8Array(readFileSync(join("samples/pdfs", f)));
      await store.addDocument("b1", { fileName: f, sha256: sha256(bytes), receivedOn: SAMPLE_FACTS.today, outcome: await recorded.extract({ bytes, fileName: f }) });
    }
    const docs = await store.listDocuments("b1");
    const result = evaluateBatch(input, docs.map((d) => ({ id: d.id, fileName: d.fileName, outcome: d.outcome ?? { ok: false, reason: "not read" } })), SAMPLE_FACTS.today);
    store.batches.set("b1", { id: "b1", name: "Sample batch #1", kind: "sample", status: "ready", today: SAMPLE_FACTS.today, input, result });
  }

  it("AC-22.4 sample batch: 2 SAFE, 10 HOLD, $162,500; PAY-02 R02 $2,000; PAY-11 R12; PAY-12 R03 $14,000", async () => {
    const r = await runBatch(loadSampleBatch("samples"), loadFixtureExtractor("samples"), SAMPLE_FACTS.today);
    expect(r.counts.safe).toBe(SAMPLE_FACTS.safe);
    expect(r.counts.hold).toBe(SAMPLE_FACTS.hold);
    expect(r.exposedCents).toBe(SAMPLE_FACTS.exposedCents);
    expect(SAMPLE_FACTS).toMatchObject({ safe: 2, hold: 10, exposedCents: 16_250_000 });
    for (const key of ["pay02", "pay11", "pay12"] as const) {
      const fact = SAMPLE_FACTS[key];
      const p = r.payments.find((x) => x.payment.id === fact.paymentId)!;
      expect(p.evaluation.decision).toBe("HOLD");
      expect(p.evaluation.findings.map((f) => f.ruleId)).toEqual([fact.rule]);
      expect(p.evaluation.exposedCents).toBe(fact.exposedCents);
      expect(p.payment.amountCents).toBe(fact.amountCents);
      expect(p.payment.invoiceNo).toBe(fact.invoice);
    }
    expect(r.payments.find((x) => x.payment.id === "PAY-02")!.evaluation.waiverUsed?.amountCents).toBe(SAMPLE_FACTS.pay02.waiverCents);
  });

  it("AC-22.4 the corrected waiver flips PAY-02 (BLP-2201, $20,000.00) HOLD → SAFE", async () => {
    const store = new MemoryAutomationStore();
    await sampleInStore(store);
    const bytes = new Uint8Array(readFileSync(join("samples/inbound/pdfs", SAMPLE_FACTS.inbound.fileName)));
    const r = await receiveDocument(store, deps, { batchId: "b1", fileName: SAMPLE_FACTS.inbound.fileName, bytes, actor: "automation", notify: false });
    expect(r.changes).toEqual([expect.objectContaining({ paymentId: "PAY-02", invoice: "BLP-2201", amountCents: 2_000_000, from: "HOLD", to: "SAFE" })]);
  });

  it("AC-22.4 on 2027-02-01 PAY-05 becomes an R09 HOLD (Brightway's insurance expired 2027-01-31)", async () => {
    const store = new MemoryAutomationStore();
    await sampleInStore(store);
    const r = await dailyCheck(store, deps, { batchId: "b1", today: SAMPLE_FACTS.coiExpiry.today, actor: "automation" });
    expect(r.changes).toContainEqual(expect.objectContaining({ paymentId: SAMPLE_FACTS.coiExpiry.paymentId, from: "SAFE", to: "HOLD" }));
    const p = store.batches.get("b1")!.result!.payments.find((x) => x.payment.id === "PAY-05")!;
    expect(p.evaluation.findings.map((f) => f.ruleId)).toEqual(["R09"]);
    expect(p.evaluation.coiExpiry).toBe(SAMPLE_FACTS.coiExpiry.expiry);
  });
});
