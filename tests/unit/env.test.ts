import { describe, expect, it } from "vitest";
import { loadEnv } from "@/env";

describe("S-1 env", () => {
  it("AC-1.2 anthropic mode without a key throws naming ANTHROPIC_API_KEY and no other value", () => {
    const secret = "re_super_secret_value";
    let message = "";
    try {
      loadEnv({ LIENGUARD_AI: "anthropic", LIENGUARD_EMAIL: "resend", RESEND_API_KEY: secret });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("ANTHROPIC_API_KEY");
    expect(message).not.toContain(secret);
  });

  it("AC-1.2 fixture mode needs no key", () => {
    const env = loadEnv({ LIENGUARD_AI: "fixture", LIENGUARD_EMAIL: "fake" });
    expect(env.LIENGUARD_AI).toBe("fixture");
    expect(env.ANTHROPIC_MODEL).toBe("claude-opus-5-5");
  });
});
