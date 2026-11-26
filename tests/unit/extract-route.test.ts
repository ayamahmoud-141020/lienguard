import { describe, expect, it, vi } from "vitest";
import { QUOTA_NOTICE } from "@/view/copy";

// Only the database step is replaced; it returns stored readings exactly as Postgres would (plain JSON).
const stored: { outcome: unknown; status: "done" | "needs review" } = { outcome: null, status: "done" };
vi.mock("@/server/batches", async (orig) => {
  const real = (await orig()) as typeof import("@/server/batches");
  return { ...real, extractDocument: vi.fn(async () => ({ status: stored.status, outcome: real.storedOutcome(stored.outcome as never) })) };
});

const { POST } = await import("@/app/api/batches/[id]/documents/[docId]/extract/route");
const { batchNotice } = await import("@/server/batches");

const call = async () => {
  vi.stubEnv("DEMO_PASSCODE", "harbor-42");
  const res = await POST(new Request("http://x", { method: "POST", headers: { "x-demo-passcode": "harbor-42" } }), { params: Promise.resolve({ id: "b1", docId: "d1" }) });
  vi.unstubAllEnvs();
  return (await res.json()) as { status: string; notice: string | null };
};

describe("S-16 the quota notice reaches the screen", () => {
  it("AC-16.3 the extract response carries 'AI quota reached, try later' for a quota failure, and no notice otherwise", async () => {
    Object.assign(stored, { status: "needs review", outcome: { ok: false, reason: "rate limit", code: "quota" } });
    expect(await call()).toEqual({ status: "needs review", notice: QUOTA_NOTICE });
    Object.assign(stored, { status: "needs review", outcome: { ok: false, reason: "blurry scan" } });
    expect(await call()).toEqual({ status: "needs review", notice: null });
  });

  it("AC-16.3 a batch with any quota-failed document gets the dashboard notice (from stored readings)", () => {
    expect(batchNotice([null, { ok: true, extraction: { kind: "unknown", waiver: null, coi: null, notes: "" } }])).toBeNull();
    expect(batchNotice([{ ok: false, reason: "blurry" }, { ok: false, reason: "rate limit", code: "quota" }])).toBe(QUOTA_NOTICE);
  });
});
