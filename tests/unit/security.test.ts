import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { requirePasscode } from "@/server/guard";
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

  it("AC-11.1 every POST route calls requirePasscode", () => {
    const posts = routeFiles("src/app/api").filter((f) => /export async function POST/.test(readFileSync(f, "utf8")));
    expect(posts.length).toBeGreaterThanOrEqual(7);
    for (const f of posts) expect(readFileSync(f, "utf8"), f).toMatch(/requirePasscode\(req\)/);
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
