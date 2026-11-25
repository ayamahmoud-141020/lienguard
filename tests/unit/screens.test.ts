import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runBatch } from "@/pipeline/run-batch";
import { loadFixtureExtractor, loadSampleBatch } from "@/pipeline/samples";
import { buildDashboard, buildPaymentDetail } from "@/view/models";
import { runQueue, type QueueStatus } from "@/lib/queue";
import { dedupeDocuments } from "@/pipeline/documents";

const expected = JSON.parse(readFileSync("samples/expected.json", "utf8")) as { today: string; batchExposedCents: number; payments: { id: string; decision: string }[] };

async function sampleResult() {
  return runBatch(loadSampleBatch("samples"), loadFixtureExtractor("samples"), expected.today);
}

describe("S-9 screens", () => {
  it("AC-9.1 same PDF bytes are stored once per batch (code dedupe + DB unique key)", () => {
    const a = new TextEncoder().encode("%PDF-1.7 a");
    const docs = dedupeDocuments([
      { fileName: "a.pdf", bytes: a },
      { fileName: "a-copy.pdf", bytes: a },
      { fileName: "b.pdf", bytes: new TextEncoder().encode("%PDF-1.7 b") },
    ]);
    expect(docs.map((d) => d.fileName)).toEqual(["a.pdf", "b.pdf"]);
    expect(docs[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(readFileSync("prisma/schema.prisma", "utf8")).toMatch(/@@unique\(\[batchId, sha256\]\)/);
  });

  it("AC-9.2 the client queue runs at most 4 at a time and reports queued → reading → done / needs review", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const seen: Record<string, QueueStatus[]> = {};
    const ids = Array.from({ length: 10 }, (_, i) => `d${i}`);
    await runQueue(
      ids,
      4,
      async (id) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return id === "d3" ? "needs review" : "done";
      },
      (id, s) => (seen[id] ??= []).push(s),
    );
    expect(maxInFlight).toBe(4);
    expect(seen.d0).toEqual(["queued", "reading", "done"]);
    expect(seen.d3).toEqual(["queued", "reading", "needs review"]);
  });

  it("AC-9.2 a failing task is reported as needs review, not lost", async () => {
    const seen: Record<string, QueueStatus> = {};
    await runQueue(["x"], 4, async () => { throw new Error("boom"); }, (id, s) => (seen[id] = s));
    expect(seen.x).toBe("needs review");
  });

  it("AC-9.3 the dashboard shows exposed $, SAFE/HOLD counts and one row per payment", async () => {
    const d = buildDashboard(await sampleResult());
    expect(d.exposed).toBe("$162,500.00");
    expect(d.exposedCents).toBe(expected.batchExposedCents);
    expect(d.safe).toBe(expected.payments.filter((p) => p.decision === "SAFE").length);
    expect(d.hold).toBe(expected.payments.filter((p) => p.decision === "HOLD").length);
    expect(d.rows).toHaveLength(12);
    expect(d.rows.find((r) => r.paymentId === "PAY-02")).toMatchObject({
      sub: "BlueLine Plumbing", project: "Lakeview Apartments", invoice: "BLP-2201", amount: "$20,000.00",
      paidDate: "2026-11-10", decision: "HOLD", rules: ["R02"], exposed: "$2,000.00",
    });
    expect(d.rows.find((r) => r.paymentId === "PAY-05")?.paidDate).toBe("not paid");
  });

  it("AC-9.4 payment detail lists matched documents and a PASS/HOLD line per rule", async () => {
    const detail = buildPaymentDetail(await sampleResult(), "PAY-10");
    expect(detail?.documents.map((d) => d.fileName).sort()).toEqual(["C04-granite.pdf", "W10-granite-PRK.pdf"]);
    // Exactly one line per MVP rule, each PASS or HOLD.
    expect(detail?.rules.map((r) => r.ruleId)).toEqual(["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R09", "R12"]);
    const byRule = Object.fromEntries((detail?.rules ?? []).map((r) => [r.ruleId, r.status]));
    expect(byRule).toEqual({ R01: "PASS", R02: "HOLD", R03: "PASS", R04: "HOLD", R05: "PASS", R06: "PASS", R07: "PASS", R09: "PASS", R12: "PASS" });
    for (const r of detail?.rules ?? []) expect(r.message.length).toBeGreaterThan(0);
    expect(detail?.rules.find((r) => r.ruleId === "R02")?.message).toContain("$3,000.00");
  });
});
