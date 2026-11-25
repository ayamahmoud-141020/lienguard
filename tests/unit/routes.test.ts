import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The route's collaborators are replaced so the test needs no database.
const created: string[] = [];
vi.mock("@/server/batches", () => ({
  createSampleBatch: vi.fn(async () => {
    const id = `batch-${created.length + 1}`;
    created.push(id);
    return id;
  }),
}));
vi.mock("@/server/audit", () => ({ audit: vi.fn(async () => undefined) }));

const { POST } = await import("@/app/api/batches/sample/route");
const { createSampleBatch } = await import("@/server/batches");

const call = (passcode?: string) =>
  POST(new Request("http://x/api/batches/sample", { method: "POST", headers: passcode ? { "x-demo-passcode": passcode } : {} }));

describe("S-9 sample batch route", () => {
  beforeEach(() => {
    created.length = 0;
    vi.stubEnv("DEMO_PASSCODE", "harbor-42");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("AC-9.1 POST /api/batches/sample with the passcode creates a batch and returns its id; a second call creates a separate batch", async () => {
    const first = await call("harbor-42");
    expect(first.status).toBe(200);
    const a = (await first.json()) as { id: string };
    const b = (await (await call("harbor-42")).json()) as { id: string };
    expect(a.id).toBe("batch-1");
    expect(b.id).toBe("batch-2");
    expect(a.id).not.toBe(b.id);
    expect(createSampleBatch).toHaveBeenCalledTimes(2);
  });

  it("AC-9.1 without the passcode no batch is created", async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(created).toHaveLength(0);
  });
});
