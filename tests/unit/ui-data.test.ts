import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runBatch } from "@/pipeline/run-batch";
import { loadFixtureExtractor, loadSampleBatch } from "@/pipeline/samples";
import { decisionSplit, holdsByReason } from "@/view/charts";
import { highlightFilled } from "@/view/highlight";
import { buildSubIssues, codeTemplate, type SubIssues } from "@/email/issues";

type Expected = { today: string; payments: { decision: string; ruleIds: string[] }[] };
const expected = JSON.parse(readFileSync("samples/expected.json", "utf8")) as Expected;
const sample = () => runBatch(loadSampleBatch("samples"), loadFixtureExtractor("samples"), expected.today);

describe("S-17 data behind the template's charts and email preview", () => {
  it("AC-17.3 holds by reason counts payments per rule id, and matches expected.json", async () => {
    const counts: Record<string, number> = {};
    for (const p of expected.payments) for (const r of new Set(p.ruleIds)) counts[r] = (counts[r] ?? 0) + 1;
    const data = holdsByReason(await sample());
    expect(Object.fromEntries(data.map((d) => [d.ruleId, d.payments]))).toEqual(counts);
    expect(data.map((d) => d.ruleId)).toEqual(["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R09", "R12"]);
    expect(data.every((d) => d.label.length > 0)).toBe(true);
  });

  it("AC-17.3 the Safe vs Hold split matches expected.json", async () => {
    const safe = expected.payments.filter((p) => p.decision === "SAFE").length;
    expect(decisionSplit(await sample())).toEqual({ safe, hold: expected.payments.length - safe });
  });

  it("AC-17.3 the preview highlights exactly the code-filled amounts and dates, nothing else", async () => {
    const sub = buildSubIssues(await sample()).find((s) => s.subCode === "BLU") as SubIssues;
    const body = `${codeTemplate(sub).body}\nAlso send $99,999.00 by December 1, 2026.`;
    const parts = highlightFilled(body, sub);
    expect(parts.map((p) => p.text).join("")).toBe(body);
    const filled = parts.filter((p) => p.filled).map((p) => p.text);
    expect(filled).toEqual(expect.arrayContaining(["$18,000.00", "$20,000.00", "$2,000.00"]));
    expect(filled).not.toContain("$99,999.00");
    expect(filled).not.toContain("December 1, 2026");
    expect(filled.every((t) => /^\$[\d,]+\.\d{2}$|^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(t))).toBe(true);
  });
});
