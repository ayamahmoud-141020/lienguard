import { z } from "zod";

const Base = z.object({
  LIENGUARD_AI: z.enum(["anthropic", "gemini", "fixture"]).default("fixture"),
  LIENGUARD_EMAIL: z.enum(["resend", "fake"]).default("fake"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
  GEMINI_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("LienGuard Demo <onboarding@resend.dev>"),
  DEMO_EMAIL_OVERRIDE: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  DEMO_PASSCODE: z.string().optional(),
  DEMO_TODAY: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default("2026-11-20"),
});

export type Env = z.infer<typeof Base>;

export class EnvError extends Error {}

/**
 * Validates env. Errors name the missing/invalid variables only, never a value.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = Base.safeParse(source);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new EnvError(`Invalid environment variables: ${names}`);
  }
  const env = parsed.data;
  const missing: string[] = [];
  if (env.LIENGUARD_AI === "anthropic" && !env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (env.LIENGUARD_AI === "gemini" && !env.GEMINI_API_KEY) missing.push("GEMINI_API_KEY");
  if (env.LIENGUARD_EMAIL === "resend" && !env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (missing.length > 0) throw new EnvError(`Missing environment variables: ${missing.join(", ")}`);
  return env;
}
