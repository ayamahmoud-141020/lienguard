/**
 * Totals what live Claude calls from the scripts cost, across runs, in .cache/spend.json (gitignored).
 * Prices are USD per million tokens (Anthropic first-party list prices, 2026-11).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};
type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };
type Ledger = { calls: number; inputTokens: number; outputTokens: number; usd: number; unpriced: number; byScript: Record<string, number> };
const FILE = ".cache/spend.json";

export function priceOf(model: string, u: Usage): number | null {
  const p = PRICES[model];
  if (!p) return null;
  return (
    (u.input_tokens * p.input + u.output_tokens * p.output + (u.cache_read_input_tokens ?? 0) * p.cacheRead + (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) / 1e6
  );
}

export function recordSpend(script: string, model: string, u: Usage): void {
  mkdirSync(".cache", { recursive: true });
  const l: Ledger = existsSync(FILE)
    ? (JSON.parse(readFileSync(FILE, "utf8")) as Ledger)
    : { calls: 0, inputTokens: 0, outputTokens: 0, usd: 0, unpriced: 0, byScript: {} };
  const usd = priceOf(model, u);
  l.calls++;
  l.inputTokens += u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  l.outputTokens += u.output_tokens;
  if (usd === null) l.unpriced++;
  else {
    l.usd += usd;
    l.byScript[script] = (l.byScript[script] ?? 0) + usd;
  }
  writeFileSync(FILE, JSON.stringify(l, null, 2));
}

export function spendSummary(): string {
  if (!existsSync(FILE)) return "No Claude spend recorded yet.";
  const l = JSON.parse(readFileSync(FILE, "utf8")) as Ledger;
  const by = Object.entries(l.byScript)
    .map(([k, v]) => `${k} $${v.toFixed(4)}`)
    .join(", ");
  return `Claude spend so far: $${l.usd.toFixed(4)} over ${l.calls} calls (${l.inputTokens} in / ${l.outputTokens} out tokens)${by ? `; ${by}` : ""}${l.unpriced ? `; ${l.unpriced} calls on a model without a listed price` : ""}`;
}
