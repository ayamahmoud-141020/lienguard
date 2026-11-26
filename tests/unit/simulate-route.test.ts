import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AC-18.4: the simulate-reply route itself (engine replaced; access and passcode logic real).
const calls: { batchId: string; notify: boolean; actor: string }[] = [];
const batches: Record<string, { kind: string }> = { s1: { kind: "sample" }, u1: { kind: "upload" } };
vi.mock("@/server/automation", async (orig) => {
  const real = (await orig()) as typeof import("@/server/automation");
  return {
    ...real,
    automationDeps: () => ({}),
    prismaAutomationStore: { loadBatch: async (id: string) => (batches[id] ? { id, ...batches[id] } : null) },
  };
});
vi.mock("@/automation/engine", async (orig) => {
  const real = (await orig()) as object;
  return { ...real, receiveDocument: vi.fn(async (_s: unknown, _d: unknown, a: { batchId: string; notify: boolean; actor: string }) => (calls.push(a), { changes: [], duplicate: false, documentId: "d" })) };
});

describe("S-18 simulate a subcontractor reply (route)", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.stubEnv("DEMO_PASSCODE", "harbor-42");
    vi.stubEnv("NODE_ENV", "production");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("AC-18.4 open without a passcode (no AP email), with one (email allowed), and only on sample batches", async () => {
    const { POST } = await import("@/app/api/batches/[id]/simulate-reply/route");
    const call = (id: string, headers: Record<string, string> = {}) => POST(new Request("http://x", { method: "POST", headers }), { params: Promise.resolve({ id }) });
    const open = await call("s1");
    expect(open.status).toBe(200);
    expect(((await open.json()) as { notified: boolean }).notified).toBe(false);
    expect(calls[0]).toMatchObject({ batchId: "s1", notify: false });
    const unlocked = await call("s1", { "x-demo-passcode": "harbor-42", "x-demo-actor": "Aya" });
    expect(((await unlocked.json()) as { notified: boolean }).notified).toBe(true);
    expect(calls[1]).toMatchObject({ notify: true, actor: "Aya" });
    expect((await call("u1")).status).toBe(400);
    expect((await call("missing")).status).toBe(404);
    expect(calls).toHaveLength(2);
  });
});
