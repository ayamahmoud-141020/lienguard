import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("S-1 skeleton", () => {
  it("AC-1.1 package scripts for lint, typecheck, test and build exist", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
    for (const s of ["lint", "typecheck", "test", "build"]) expect(pkg.scripts[s]).toBeTruthy();
  });

  it("AC-1.1 CI runs lint, typecheck, tests and build with no secrets", () => {
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    for (const s of ["pnpm lint", "pnpm typecheck", "pnpm test:unit", "pnpm test:e2e", "next build"]) expect(ci).toContain(s);
    expect(ci).not.toMatch(/secrets\./);
  });
});
