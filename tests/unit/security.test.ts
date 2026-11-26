import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { requirePasscode } from "@/server/guard";
import { PASSCODE_ACTIONS, PUBLIC_ACTIONS, draftAction, guard } from "@/server/access";
import { checkUpload, MAX_UPLOAD_BYTES } from "@/server/uploads";
import { healthReport } from "@/server/health";

const req = (passcode?: string) => new Request("http://x/api", { method: "POST", headers: passcode ? { "x-demo-passcode": passcode } : {} });

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? routeFiles(p) : f === "route.ts" ? [p] : [];
  });
}

describe("S-11 security", () => {
  it("AC-11.1 write actions return 401 without the right passcode", async () => {
    const env = { DEMO_PASSCODE: "harbor-42", NODE_ENV: "production" };
    expect(requirePasscode(req(), env)?.status).toBe(401);
    expect(requirePasscode(req("wrong"), env)?.status).toBe(401);
    expect(requirePasscode(req("harbor-42"), env)).toBeNull();
    expect(requirePasscode(req("anything"), { NODE_ENV: "production" })?.status).toBe(401);
  });

  it("AC-14.1 every POST route goes through guard() with its declared action", () => {
    const declared: Record<string, RegExp> = {
      "src/app/api/batches/sample/route.ts": /guard\(req, "batch\.sample"\)/,
      "src/app/api/batches/route.ts": /guard\(req, "batch\.upload"\)/,
      "src/app/api/batches/[id]/documents/route.ts": /guard\(req, "document\.upload"\)/,
      "src/app/api/batches/[id]/documents/[docId]/extract/route.ts": /guard\(req, "document\.extract"\)/,
      "src/app/api/batches/[id]/evaluate/route.ts": /guard\(req, "batch\.evaluate"\)/,
      "src/app/api/batches/[id]/drafts/route.ts": /guard\(req, "drafts\.generate"\)/,
      "src/app/api/drafts/[draftId]/[action]/route.ts": /guard\(req, draftAction\(action\)\)/,
      "src/app/api/batches/[id]/simulate-reply/route.ts": /guard\(req, "batch\.simulate_reply"\)/,
      "src/app/api/batches/[id]/daily-check/route.ts": /guard\(req, "batch\.daily_check"\)/,
      // Machine-to-machine: its own secret instead of the demo passcode (AC-18.1).
      "src/app/api/inbound/route.ts": /requireInboundSecret\(req\)/,
    };
    const posts = routeFiles("src/app/api").filter((f) => /export async function POST/.test(readFileSync(f, "utf8")));
    expect(posts.sort()).toEqual(Object.keys(declared).sort());
    for (const f of posts) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toMatch(declared[f]!);
      expect(src, f).not.toMatch(/requirePasscode\(/);
    }
  });

  it("AC-14.1 sample, generate drafts, approve and skip are open; uploads, extract, evaluate, edit and send need the passcode", () => {
    const env = { DEMO_PASSCODE: "harbor-42", NODE_ENV: "production" };
    expect([...PUBLIC_ACTIONS].sort()).toEqual(["batch.sample", "batch.simulate_reply", "draft.approve", "draft.skip", "drafts.generate"]);
    expect([...PASSCODE_ACTIONS].sort()).toEqual(["batch.daily_check", "batch.evaluate", "batch.upload", "document.extract", "document.upload", "draft.edit", "draft.send"]);
    for (const a of PUBLIC_ACTIONS) expect(guard(req(), a, env), a).toBeNull();
    for (const a of PASSCODE_ACTIONS) {
      expect(guard(req(), a, env)?.status, a).toBe(401);
      expect(guard(req("harbor-42"), a, env), a).toBeNull();
    }
    expect(draftAction("approve")).toBe("draft.approve");
    expect(draftAction("send")).toBe("draft.send");
    expect(draftAction("nonsense")).toBe("draft.send");
  });

  it("AC-11.2 uploads must have the right magic bytes and be at most 4 MB", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7 ...");
    const xlsx = new Uint8Array([0x50, 0x4b, 3, 4, 0]);
    expect(checkUpload(pdf, "pdf").ok).toBe(true);
    expect(checkUpload(xlsx, "xlsx").ok).toBe(true);
    expect(checkUpload(new TextEncoder().encode("<html>"), "pdf")).toEqual({ ok: false, error: "not a PDF file" });
    expect(checkUpload(pdf, "xlsx").ok).toBe(false);
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(pdf);
    expect(checkUpload(big, "pdf")).toEqual({ ok: false, error: "file is larger than 4 MB" });
  });

  it("AC-11.3 health reports booleans only and never an env value", async () => {
    const secretEnv = { DATABASE_URL: "postgresql://user:s3cr3t@host/db", ANTHROPIC_API_KEY: "sk-ant-secret", RESEND_API_KEY: "re_secret", DEMO_PASSCODE: "pass-123" };
    const report = await healthReport(secretEnv, async () => true);
    expect(report).toEqual({
      ok: true,
      db: true,
      env: { DATABASE_URL: true, DIRECT_URL: false, ANTHROPIC_API_KEY: true, GEMINI_API_KEY: false, RESEND_API_KEY: true, DEMO_PASSCODE: true, DEMO_EMAIL_OVERRIDE: false },
    });
    const text = JSON.stringify(report);
    for (const v of Object.values(secretEnv)) expect(text).not.toContain(v);
    const down = await healthReport({}, async () => { throw new Error("connect ECONNREFUSED postgresql://user:s3cr3t@host"); });
    expect(down.ok).toBe(false);
    expect(JSON.stringify(down)).not.toContain("s3cr3t");
  });
});
