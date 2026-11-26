import { describe, expect, it, vi } from "vitest";
import { Extraction, type ExtractionT } from "@/ai/schemas";
import { toDocument } from "@/ai/to-document";
import { FixtureExtractor } from "@/ai/fixture-extractor";
import { cachedExtract, type ExtractionCache } from "@/ai/cache";
import { AnthropicExtractor, type ParseFn } from "@/ai/anthropic-extractor";
import { sha256 } from "@/ai/hash";
import type { Extractor } from "@/ai/extractor";

const f = <T>(value: T, confidence = 0.95) => ({ value, confidence, sourceText: String(value) });

function waiverExtraction(over: Partial<NonNullable<ExtractionT["waiver"]>> = {}): ExtractionT {
  return {
    kind: "waiver",
    waiver: {
      claimantName: f("Summit Air Mechanical, LLC"),
      customerName: f("Harborline Builders"),
      projectName: f("Riverside Medical Office"),
      type: f("unconditional" as const),
      scope: f("progress" as const),
      amount: f("$20,000.00"),
      throughDate: f("October 31, 2026"),
      signed: f(true),
      notarized: f(false),
      exceptions: f(null),
      ...over,
    },
    coi: null,
    notes: "",
  };
}

const coiExtraction: ExtractionT = {
  kind: "coi",
  waiver: null,
  coi: { insuredName: f("Copperleaf Roofing LLC"), certificateHolder: f("Harborline Builders"), glExpiry: f("11/10/2026") },
  notes: "",
};

const meta = { documentId: "doc-1", fileName: "w.pdf" };

describe("S-5 schemas", () => {
  it("AC-5.1 accepts valid waiver and COI extractions", () => {
    expect(Extraction.safeParse(waiverExtraction()).success).toBe(true);
    expect(Extraction.safeParse(coiExtraction).success).toBe(true);
  });
  it("AC-5.1 rejects a wrong enum and a missing claimantName", () => {
    const bad = waiverExtraction() as unknown as { waiver: Record<string, unknown> };
    bad.waiver.type = f("partial");
    expect(Extraction.safeParse(bad).success).toBe(false);
    const missing = waiverExtraction() as unknown as { waiver: Record<string, unknown> };
    delete missing.waiver.claimantName;
    expect(Extraction.safeParse(missing).success).toBe(false);
  });
});

describe("S-5 toDocument", () => {
  it("AC-5.2 a clean extraction parses cents and ISO dates", () => {
    const d = toDocument(waiverExtraction(), meta);
    expect(d.waiver).toMatchObject({ amountCents: 2000000, throughDate: "2026-10-31", needsReview: false, type: "unconditional" });
  });
  it("AC-5.2 low confidence on a required field → needsReview naming the field", () => {
    const d = toDocument(waiverExtraction({ amount: f("$20,000.00", 0.5) }), meta);
    expect(d.waiver?.needsReview).toBe(true);
    expect(d.waiver?.reviewReasons.join(" ")).toContain("amount");
  });
  it("AC-5.2 a null required field → needsReview", () => {
    const d = toDocument(waiverExtraction({ throughDate: { value: null, confidence: 0.9, sourceText: "" } }), meta);
    expect(d.waiver?.needsReview).toBe(true);
    expect(d.waiver?.reviewReasons.join(" ")).toContain("throughDate");
  });
  it("AC-5.2 an unparseable amount → needsReview", () => {
    const d = toDocument(waiverExtraction({ amount: f("twenty thousand-ish") }), meta);
    expect(d.waiver?.needsReview).toBe(true);
    expect(d.waiver?.amountCents).toBeNull();
    expect(d.waiver?.reviewReasons.join(" ")).toContain("amount");
  });
  it("AC-5.2 a COI parses its expiry", () => {
    const d = toDocument(coiExtraction, meta);
    expect(d.coi).toMatchObject({ insuredName: "Copperleaf Roofing LLC", glExpiry: "2026-11-10", needsReview: false });
  });
});

describe("S-5 FixtureExtractor", () => {
  it("AC-5.3 returns the fixture by SHA-256 and unknown for other bytes", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7 sample");
    const ex = new FixtureExtractor(new Map([[sha256(bytes), waiverExtraction()]]));
    const hit = await ex.extract({ bytes, fileName: "a.pdf" });
    expect(hit).toEqual({ ok: true, extraction: waiverExtraction() });
    const miss = await ex.extract({ bytes: new TextEncoder().encode("%PDF other"), fileName: "b.pdf" });
    expect(miss.ok).toBe(true);
    if (miss.ok) {
      expect(miss.extraction.kind).toBe("unknown");
      expect(toDocument(miss.extraction, meta).needsReview).toBe(true);
    }
  });
});

describe("S-5 cache", () => {
  it("AC-5.4 same bytes twice → inner extractor called once", async () => {
    const inner: Extractor = { extract: vi.fn(async () => ({ ok: true as const, extraction: waiverExtraction() })) };
    const store = new Map<string, ExtractionT>();
    const cache: ExtractionCache = { get: async (k) => store.get(k) ?? null, set: async (k, v) => void store.set(k, v) };
    const bytes = new TextEncoder().encode("%PDF same");
    const a = await cachedExtract(inner, cache, { bytes, fileName: "x.pdf" });
    const b = await cachedExtract(inner, cache, { bytes, fileName: "x-copy.pdf" });
    expect(inner.extract).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });
});

describe("S-5 AnthropicExtractor (fake client, no network)", () => {
  const bytes = new TextEncoder().encode("%PDF-1.7 fake");

  it("AC-5.5 sends a base64 document, model from env, low effort, a format and an untrusted-data system prompt", async () => {
    const parse = vi.fn<ParseFn>(async () => ({ stop_reason: "end_turn", parsed_output: waiverExtraction() }));
    const ex = new AnthropicExtractor(parse, "claude-opus-5-5");
    const r = await ex.extract({ bytes, fileName: "w.pdf" });
    expect(r.ok).toBe(true);
    expect(parse).toHaveBeenCalledTimes(1);
    const req = parse.mock.calls[0]![0];
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.output_config?.effort).toBe("low");
    expect(req.output_config?.format).toBeTruthy();
    expect(String(req.system)).toMatch(/untrusted/i);
    const content = req.messages[0]!.content as Array<{ type: string; source?: { type: string; media_type: string; data: string } }>;
    expect(content[0]).toMatchObject({ type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(bytes).toString("base64") } });
  });

  it("AC-5.6 invalid output then valid → valid after exactly 2 calls", async () => {
    const parse = vi
      .fn<ParseFn>()
      .mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: { kind: "waiver" } })
      .mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: waiverExtraction() });
    const r = await new AnthropicExtractor(parse, "m").extract({ bytes, fileName: "w.pdf" });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(r).toEqual({ ok: true, extraction: waiverExtraction() });
  });

  it("AC-5.6 invalid twice → needs review", async () => {
    const parse = vi.fn<ParseFn>(async () => ({ stop_reason: "end_turn", parsed_output: null }));
    const r = await new AnthropicExtractor(parse, "m").extract({ bytes, fileName: "w.pdf" });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(r.ok).toBe(false);
  });

  it("AC-5.6 a refusal → needs review without retry", async () => {
    const parse = vi.fn<ParseFn>(async () => ({ stop_reason: "refusal", parsed_output: null }));
    const r = await new AnthropicExtractor(parse, "m").extract({ bytes, fileName: "w.pdf" });
    expect(parse).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ ok: false });
  });
});
