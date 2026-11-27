/** The commit the /flows page was traced from (AC-23.4). Resolved once at build time in next.config.ts. */

export function shortSha(raw: string | undefined): string {
  const s = (raw ?? "").trim();
  return /^[0-9a-f]{7,40}$/i.test(s) ? s.slice(0, 7).toLowerCase() : "unknown";
}

/** Vercel's build commit first, then the local checkout, else "unknown". */
export function resolveCommitSha(env: Record<string, string | undefined>, git: () => string): string {
  if (env.VERCEL_GIT_COMMIT_SHA) return shortSha(env.VERCEL_GIT_COMMIT_SHA);
  try {
    return shortSha(git());
  } catch {
    return "unknown";
  }
}

export function footerText(sha: string): string {
  return `Traced from lienguard main @ ${sha}. Payloads are examples from the sample data.`;
}
