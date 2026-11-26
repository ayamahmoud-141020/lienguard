const CHECKED = ["DATABASE_URL", "DIRECT_URL", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "RESEND_API_KEY", "DEMO_PASSCODE", "DEMO_EMAIL_OVERRIDE"] as const;

export type Health = { ok: boolean; db: boolean; env: Record<(typeof CHECKED)[number], boolean> };

/** Reports only whether things are present/reachable. Never returns a value or an error message. */
export async function healthReport(env: Record<string, string | undefined>, pingDb: () => Promise<unknown>): Promise<Health> {
  let db = false;
  try {
    await pingDb();
    db = true;
  } catch {
    db = false;
  }
  const flags = Object.fromEntries(CHECKED.map((k) => [k, Boolean(env[k]?.trim())])) as Health["env"];
  return { ok: db, db, env: flags };
}
