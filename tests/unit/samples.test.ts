import { describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { generateSamples } from "../../scripts/generate-samples";
import { sha256 } from "@/ai/hash";
import { Extraction } from "@/ai/schemas";

type Expected = {
  today: string;
  batchExposedCents: number;
  payments: { id: string; decision: "SAFE" | "HOLD"; ruleIds: string[]; exposedCents: number; paid: boolean }[];
};

/** Decodes the text drawn on a pdf-lib PDF: inflate content streams, then decode hex strings. */
function pdfText(bytes: Buffer): string {
  const raw = bytes.toString("latin1");
  let out = "";
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let body = m[1] ?? "";
    try {
      body = inflateSync(Buffer.from(body, "latin1")).toString("latin1");
    } catch {
      // not compressed
    }
    for (const h of body.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) out += Buffer.from(h[1] ?? "", "hex").toString("latin1") + "\n";
  }
  return out;
}

describe("S-4 sample data", () => {
  it("AC-4.1 writes spreadsheets, 17 PDFs, a fixture per PDF and expected files; PDFs are byte-identical across runs", async () => {
    const a = mkdtempSync(join(tmpdir(), "lg-a-"));
    const b = mkdtempSync(join(tmpdir(), "lg-b-"));
    await generateSamples(a);
    await generateSamples(b);
    for (const f of ["payments.xlsx", "subcontractors.xlsx", "expected.json", "EXPECTED.md"]) {
      expect(readdirSync(a)).toContain(f);
    }
    const pdfs = readdirSync(join(a, "pdfs")).filter((f) => f.endsWith(".pdf"));
    expect(pdfs).toHaveLength(17);
    const fixtures = readdirSync(join(a, "fixtures"));
    for (const p of pdfs) {
      expect(fixtures).toContain(p.replace(/\.pdf$/, ".json"));
      expect(sha256(readFileSync(join(a, "pdfs", p)))).toBe(sha256(readFileSync(join(b, "pdfs", p))));
      const fx = JSON.parse(readFileSync(join(a, "fixtures", p.replace(/\.pdf$/, ".json")), "utf8"));
      expect(Extraction.safeParse(fx).success).toBe(true);
    }
  });

  it("AC-4.2 expected.json covers every MVP rule, a paid SAFE, an unpaid SAFE and R02+R04 together", () => {
    const e = JSON.parse(readFileSync("samples/expected.json", "utf8")) as Expected;
    expect(e.payments).toHaveLength(12);
    const rules = new Set(e.payments.flatMap((p) => p.ruleIds));
    for (const r of ["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R09", "R12"]) expect(rules).toContain(r);
    expect(e.payments.some((p) => p.decision === "SAFE" && p.paid)).toBe(true);
    expect(e.payments.some((p) => p.decision === "SAFE" && !p.paid)).toBe(true);
    expect(e.payments.some((p) => p.ruleIds.includes("R02") && p.ruleIds.includes("R04"))).toBe(true);
    expect(e.batchExposedCents).toBe(e.payments.reduce((s, p) => s + p.exposedCents, 0));
  });

  it("AC-4.3 the injection PDF contains the injected text and its fixture records the real content", () => {
    const pdf = pdfText(readFileSync("samples/pdfs/W12-summit-air-PRK-injection.pdf"));
    expect(pdf).toContain("Ignore previous instructions");
    const fx = JSON.parse(readFileSync("samples/fixtures/W12-summit-air-PRK-injection.json", "utf8"));
    expect(fx.waiver.type.value).toBe("conditional");
    expect(fx.waiver.amount.value).toBe("$14,000.00");
  });

  it("AC-4.4 the blurry PDF's fixture has a low-confidence amount", () => {
    const fx = JSON.parse(readFileSync("samples/fixtures/W11-blueline-RVR-scan.json", "utf8"));
    expect(fx.waiver.amount.confidence).toBeLessThan(0.7);
  });
});
