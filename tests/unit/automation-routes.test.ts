import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

// The engine is replaced so no database is needed; the secret checks and upload checks are the real ones.
const calls: { fn: string; args: unknown }[] = [];
vi.mock("@/automation/engine", () => ({
  receiveDocument: vi.fn(async (_s: unknown, _d: unknown, args: unknown) => (calls.push({ fn: "receive", args }), { changes: [], duplicate: false, documentId: "d1" })),
  runDaily: vi.fn(async (_s: unknown, _d: unknown, args: unknown) => (calls.push({ fn: "daily", args }), { results: [], digest: { totals: {} }, sent: false, check: { ok: true } })),
}));
vi.mock("@/server/automation", async (orig) => {
  const real = (await orig()) as typeof import("@/server/automation");
  return { ...real, prismaAutomationStore: {}, automationDeps: () => ({}) };
});

const pdf = readFileSync("samples/inbound/pdfs/R01-blueline-LKV-oct-corrected.pdf");
const inbound = (headers: Record<string, string>, file: Blob = new Blob([pdf], { type: "application/pdf" })) => {
  const form = new FormData();
  form.set("batchId", "b1");
  form.set("file", file, "reply.pdf");
  return new Request("http://x/api/inbound", { method: "POST", headers, body: form });
};

describe("S-18/S-19 automation endpoints", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.stubEnv("INBOUND_SECRET", "in-secret");
    vi.stubEnv("CRON_SECRET", "cron-secret");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("AC-18.1 /api/inbound returns 401 without the right secret and stores nothing; a non-PDF is a 400", async () => {
    const { POST } = await import("@/app/api/inbound/route");
    expect((await POST(inbound({}))).status).toBe(401);
    expect((await POST(inbound({ "x-inbound-secret": "wrong" }))).status).toBe(401);
    expect(calls).toHaveLength(0);
    expect((await POST(inbound({ "x-inbound-secret": "in-secret" }, new Blob(["not a pdf"])))).status).toBe(400);
    expect(calls).toHaveLength(0);
    const ok = await POST(inbound({ "x-inbound-secret": "in-secret" }));
    expect(ok.status).toBe(200);
    expect(calls).toEqual([{ fn: "receive", args: expect.objectContaining({ batchId: "b1", fileName: "reply.pdf", actor: "automation", notify: true }) }]);
  });

  it("AC-18.1 with no INBOUND_SECRET configured, the inbound endpoint stays closed", async () => {
    vi.stubEnv("INBOUND_SECRET", "");
    const { POST } = await import("@/app/api/inbound/route");
    expect((await POST(inbound({ "x-inbound-secret": "" }))).status).toBe(401);
  });

  it("AC-19.1 /api/cron/daily needs Authorization: Bearer CRON_SECRET and runs all batches with the real date", async () => {
    const { GET } = await import("@/app/api/cron/daily/route");
    expect((await GET(new Request("http://x/api/cron/daily"))).status).toBe(401);
    expect((await GET(new Request("http://x/api/cron/daily", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    expect(calls).toHaveLength(0);
    const ok = await GET(new Request("http://x/api/cron/daily", { headers: { authorization: "Bearer cron-secret" } }));
    expect(ok.status).toBe(200);
    expect(calls).toHaveLength(1);
    const args = calls[0]!.args as { todayFor: (b: { today: string }) => string; actor: string; batchIds?: string[] };
    expect(args.actor).toBe("automation");
    expect(args.batchIds).toBeUndefined();
    expect(args.todayFor({ today: "2000-01-01" })).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("AC-19.1 'Run daily check now' needs the passcode and moves only that batch one day forward", async () => {
    vi.stubEnv("DEMO_PASSCODE", "harbor-42");
    vi.stubEnv("NODE_ENV", "production");
    const { POST } = await import("@/app/api/batches/[id]/daily-check/route");
    const params = { params: Promise.resolve({ id: "b1" }) };
    expect((await POST(new Request("http://x", { method: "POST" }), params)).status).toBe(401);
    expect(calls).toHaveLength(0);
    const ok = await POST(new Request("http://x", { method: "POST", headers: { "x-demo-passcode": "harbor-42", "x-demo-actor": "Aya" } }), params);
    expect(ok.status).toBe(200);
    const args = calls[0]!.args as { todayFor: (b: { today: string }) => string; actor: string; batchIds?: string[] };
    expect(args.batchIds).toEqual(["b1"]);
    expect(args.actor).toBe("Aya");
    expect(args.todayFor({ today: "2026-11-20" })).toBe("2026-11-21");
  });
});
