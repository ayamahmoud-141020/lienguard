import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { resolveCommitSha } from "./src/flows/commit";

const nextConfig: NextConfig = {
  // Sample PDFs and spreadsheets are read at runtime by the "Use sample data" route.
  outputFileTracingIncludes: { "/api/**": ["./samples/**/*"] },
  // The /flows footer names the commit the page was traced from (AC-23.4).
  env: {
    NEXT_PUBLIC_COMMIT_SHA: resolveCommitSha(process.env, () => execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString()),
  },
};

export default nextConfig;
