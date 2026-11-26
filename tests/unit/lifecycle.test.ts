import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { finishBatch, nextBatchAction, readDocument, samplesToDelete, STALE_MS } from "@/pipeline/lifecycle";
import { createSampleBatch } from "@/server/batches";
import { MemoryBatchStore } from "./memory-batch-store";

type Expected = { today: string; batchExposedCents: number; payments: { id: string; decision: string; ruleIds: string[]; exposedCents: number }[] };
const expected = JSON.parse(readFileSync("samples/expected.json", "utf8")) as Expected;
const now = new Date("2026-11-26T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("S-13 deterministic sample batch, no stuck batches", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("AC-13.1 the sample batch is ready at once, from recorded readings, and equals expected.json every time — even with live AI configured", async () => {
    vi.stubEnv("LIENGUARD_AI", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "AQ.test-only-value");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const store = new MemoryBatchStore();
    for (let run = 0; run < 3; run++) {
      const id = await createSampleBatch(store, "samples", expected.today);
      const b = store.get(id);
      expect(b.status).toBe("ready");
      expect(b.kind).toBe("sample");
      const actual = b.result!.payments.map((p) => ({ id: p.payment.id, decision: p.evaluation.decision, ruleIds: p.evaluation.findings.map((f) => f.ruleId).sort(), exposedCents: p.evaluation.exposedCents }));
      expect(actual).toEqual(expected.payments.map(({ id, decision, ruleIds, exposedCents }) => ({ id, decision, ruleIds, exposedCents })));
      expect(b.result!.exposedCents).toBe(expected.batchExposedCents);
      expect(store.docsOf(id).every((d) => d.status !== "queued")).toBe(true);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("AC-13.2 an extraction that throws gives needs_review with the reason, never queued", async () => {
    const r = await readDocument(async () => { throw new Error("upstream timed out"); }, { documentId: "d1", fileName: "a.pdf" });
    expect(r.status).toBe("needs_review");
    expect(r.outcome).toEqual({ ok: false, reason: "could not read the document (upstream timed out)" });
  });

  it("AC-13.3 a processing batch is finished when nothing is queued, or when it has been idle for 3 minutes", () => {
    expect(nextBatchAction({ status: "processing", updatedAt: ago(1000), docStatuses: ["done", "needs_review"] }, now)).toBe("evaluate");
    expect(nextBatchAction({ status: "processing", updatedAt: ago(1000), docStatuses: ["done", "queued"] }, now)).toBe("wait");
    expect(nextBatchAction({ status: "processing", updatedAt: ago(STALE_MS + 1), docStatuses: ["queued", "queued"] }, now)).toBe("evaluate");
    expect(nextBatchAction({ status: "processing", updatedAt: ago(1000), docStatuses: [] }, now)).toBe("wait");
    expect(nextBatchAction({ status: "ready", updatedAt: ago(STALE_MS * 10), docStatuses: ["queued"] }, now)).toBe("none");
    expect(nextBatchAction({ status: "failed", updatedAt: ago(STALE_MS * 10), docStatuses: [] }, now)).toBe("none");
  });

  it("AC-13.4 if evaluation throws, the batch becomes failed with a visible message", async () => {
    const failed: [string, string][] = [];
    const out = await finishBatch("b1", async () => { throw new Error("stored input is invalid"); }, async (id, msg) => void failed.push([id, msg]));
    expect(out).toBe("failed");
    expect(failed).toEqual([["b1", "Could not apply the rules: stored input is invalid"]]);
    expect(await finishBatch("b2", async () => undefined, async () => undefined)).toBe("ready");
  });
});

describe("S-14 open sample data", () => {
  it("AC-14.2 only the newest 20 sample batches are kept; uploads are never deleted", () => {
    const batches = [
      ...Array.from({ length: 22 }, (_, i) => ({ id: `s${i}`, kind: "sample", createdAt: new Date(2026, 10, 1, 0, i) })),
      { id: "u-old", kind: "upload", createdAt: new Date(2020, 0, 1) },
    ];
    expect(samplesToDelete(batches, 20).sort()).toEqual(["s0", "s1"]);
    expect(samplesToDelete(batches.slice(0, 5), 20)).toEqual([]);
  });
});
