import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SAMPLE_NOTE, QUOTA_NOTICE, quotaNotice } from "@/view/copy";
import { GeminiExtractor } from "@/ai/gemini-extractor";
import { readDocument } from "@/pipeline/lifecycle";
import { storedOutcome } from "@/server/batches";
import type { GenerateFn } from "@/ai/gemini";

const pdf = new Uint8Array(readFileSync("samples/pdfs/W01-summit-air-RVR.pdf"));
const quota: GenerateFn = async () => {
  throw Object.assign(new Error("HTTP 429"), { status: 429 });
};

describe("S-16 honest sample note, clear AI-quota message", () => {
  it("AC-16.1 the sample batch page and the README show the same honest note", () => {
    expect(SAMPLE_NOTE).toMatch(/hand-checked readings/);
    expect(SAMPLE_NOTE).toMatch(/105 of 106 fields/);
    // Names the model behind the number (smoke run 2026-11-26: claude-opus-5-5 and Gemini each 105/106).
    expect(SAMPLE_NOTE).toMatch(/Claude \(claude-opus-5-5\) and Gemini/);
    expect(SAMPLE_NOTE).toMatch(/Upload your own PDFs to see live extraction/);
    expect(SAMPLE_NOTE).not.toMatch(/recorded from a live Gemini run/);
    expect(readFileSync("README.md", "utf8")).toContain(SAMPLE_NOTE);
    const page = readFileSync("src/app/batches/[id]/page.tsx", "utf8");
    expect(page).toMatch(/SAMPLE_NOTE/);
  });

  it("AC-16.2 a 429 after backoff is ok:false with code quota, and the document goes to needs review", async () => {
    const out = await new GeminiExtractor(quota, "m").extract({ bytes: pdf, fileName: "a.pdf" });
    expect(out).toMatchObject({ ok: false, code: "quota" });
    const read = await readDocument(async () => out, { documentId: "d1", fileName: "a.pdf" });
    expect(read.status).toBe("needs_review");
    // The code survives storage and reload.
    expect(storedOutcome(JSON.parse(JSON.stringify(read.outcome)))).toMatchObject({ ok: false, code: "quota" });
  });

  it("AC-16.3 the notice is 'AI quota reached, try later' whenever any reading hit the quota", () => {
    expect(QUOTA_NOTICE).toMatch(/^AI quota reached, try later/);
    expect(quotaNotice([{ ok: true, extraction: { kind: "unknown", waiver: null, coi: null, notes: "" } }, { ok: false, reason: "blurry" }])).toBeNull();
    expect(quotaNotice([{ ok: false, reason: "x", code: "quota" }])).toBe(QUOTA_NOTICE);
    const route = readFileSync("src/app/api/batches/[id]/documents/[docId]/extract/route.ts", "utf8");
    expect(route).toMatch(/notice/);
  });
});
