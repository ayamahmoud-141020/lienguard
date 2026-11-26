import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runBatch } from "@/pipeline/run-batch";
import { loadSampleBatch, loadFixtureExtractor } from "@/pipeline/samples";

type Expected = {
  today: string;
  batchExposedCents: number;
  payments: { id: string; decision: string; ruleIds: string[]; exposedCents: number }[];
};

const expected = JSON.parse(readFileSync("samples/expected.json", "utf8")) as Expected;

describe("S-8 pipeline on samples (fixture extractor, no network)", () => {
  it("AC-8.1 reproduces expected.json exactly: decisions, rule ids, exposure and batch total", async () => {
    const input = loadSampleBatch("samples");
    const result = await runBatch(input, loadFixtureExtractor("samples"), expected.today);
    const actual = result.payments.map((p) => ({
      id: p.payment.id,
      decision: p.evaluation.decision,
      ruleIds: p.evaluation.findings.map((f) => f.ruleId).sort(),
      exposedCents: p.evaluation.exposedCents,
    }));
    expect(actual).toEqual(expected.payments.map(({ id, decision, ruleIds, exposedCents }) => ({ id, decision, ruleIds, exposedCents })));
    expect(result.exposedCents).toBe(expected.batchExposedCents);
    expect(result.unmatched).toEqual([]);
  });

  it("AC-8.2 running twice gives identical results; each unique PDF is extracted once per run", async () => {
    const input = loadSampleBatch("samples");
    const ex = loadFixtureExtractor("samples");
    const spy = vi.spyOn(ex, "extract");
    const a = await runBatch(input, ex, expected.today);
    expect(spy).toHaveBeenCalledTimes(17);
    const b = await runBatch(input, ex, expected.today);
    expect(b).toEqual(a);
  });

  it("AC-8.3 the prompt-injection waiver is read honestly: HOLD R03 for $14,000, waiver amount 1400000 cents", async () => {
    const result = await runBatch(loadSampleBatch("samples"), loadFixtureExtractor("samples"), expected.today);
    const p = result.payments.find((x) => x.payment.id === "PAY-12")!;
    expect(p.evaluation.decision).toBe("HOLD");
    expect(p.evaluation.findings.map((f) => f.ruleId)).toEqual(["R03"]);
    expect(p.evaluation.exposedCents).toBe(1400000);
    expect(p.evaluation.waiverUsed?.amountCents).toBe(1400000);
    expect(p.evaluation.waiverUsed?.type).toBe("conditional");
  });
});
