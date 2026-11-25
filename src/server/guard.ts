import { timingSafeEqual } from "node:crypto";

export const PASSCODE_HEADER = "x-demo-passcode";

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Every write action needs the shared demo passcode, so strangers can't send
 * emails or spend AI credits through the public demo. Returns a 401 response or null.
 * Without DEMO_PASSCODE, writes are allowed only outside production (local dev).
 */
export function requirePasscode(req: Request, env: { DEMO_PASSCODE?: string; NODE_ENV?: string } = process.env): Response | null {
  const expected = env.DEMO_PASSCODE;
  if (!expected) {
    return env.NODE_ENV === "production" ? Response.json({ error: "Demo passcode is not configured" }, { status: 401 }) : null;
  }
  const given = req.headers.get(PASSCODE_HEADER) ?? "";
  return same(given, expected) ? null : Response.json({ error: "Wrong or missing demo passcode" }, { status: 401 });
}

/** The reviewer's display name, typed once per session in the UI (for approvedBy / audit). */
export function actorFrom(req: Request): string {
  const raw = req.headers.get("x-demo-actor") ?? "";
  const clean = raw.replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 60);
  return clean || "demo user";
}
