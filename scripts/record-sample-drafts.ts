/**
 * Records the sample batch's follow-up email wording from a live AI run (S-21): Gemini or Claude,
 * whichever LIENGUARD_AI selects. Each file stores which model wrote it.
 * Saves the model's placeholder templates (no amounts or dates) to samples/drafts/<subCode>.json.
 * A recording is kept only if it passes the same fill + post-check as a live draft.
 *   pnpm record:drafts      # needs the provider's key in .env.local; never runs in CI
 * Re-running keeps recordings that still match the samples and records only the missing ones.
 * Never prints env values.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildSubIssues, buildWriterInput } from "@/email/issues";
import { fillPlaceholders, postcheck } from "@/email/postcheck";
import { GeminiEmailWriter } from "@/email/gemini-writer";
import { AnthropicEmailWriter } from "@/email/anthropic-writer";
import type { EmailWriter } from "@/email/writer";
import { recordSpend, spendSummary } from "./lib/spend";
import { runBatch } from "@/pipeline/run-batch";
import { loadFixtureExtractor, loadSampleBatch } from "@/pipeline/samples";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const provider = process.env.LIENGUARD_AI === "anthropic" ? "anthropic" : "gemini";
const key = provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.GEMINI_API_KEY;
const model = provider === "anthropic" ? process.env.ANTHROPIC_MODEL || "claude-opus-5-5" : process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
if (!key) {
  console.error(`The ${provider === "anthropic" ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY"} is not set (put it in .env.local in the project root).`);
  process.exit(1);
}
console.log(`Provider: ${provider} · model ${model}`);
const today = process.env.DEMO_TODAY || "2026-11-20";
const writer: EmailWriter =
  provider === "anthropic" ? new AnthropicEmailWriter(key, model, (u) => recordSpend("record:drafts", model, u)) : GeminiEmailWriter.fromApiKey(key, model, 1);
const result = await runBatch(loadSampleBatch("samples"), loadFixtureExtractor("samples"), today);
const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`no answer after ${ms / 1000}s`)), ms))]);
let failed = 0;
for (const sub of buildSubIssues(result)) {
  const input = buildWriterInput(sub);
  const path = join("samples", "drafts", `${sub.subCode}.json`);
  if (existsSync(path) && JSON.stringify(JSON.parse(readFileSync(path, "utf8")).forModel) === JSON.stringify(input.forModel)) {
    console.log(`${sub.subCode}: already recorded`);
    continue;
  }
  let feedback: string | undefined;
  let saved = false;
  for (let attempt = 0; attempt < 2 && !saved; attempt++) {
    let w;
    try {
      w = await withTimeout(writer.write(input.forModel, feedback), 120_000);
    } catch (e) {
      console.log(`${sub.subCode}: attempt ${attempt + 1} failed: ${e instanceof Error ? e.message.slice(0, 120) : "error"}`);
      continue;
    }
    const s = fillPlaceholders(w.subject, input.tokens);
    const b = fillPlaceholders(w.bodyTemplate, input.tokens);
    const check = s.ok && b.ok ? postcheck(`${s.text}\n${b.text}`, sub) : { ok: false, problems: [!s.ok ? s.error : !b.ok ? b.error : ""] };
    if (!check.ok) {
      feedback = check.problems.join("; ");
      console.log(`${sub.subCode}: attempt ${attempt + 1} failed the post-check: ${feedback}`);
      continue;
    }
    const file = { recordedFrom: model, recordedOn: new Date().toISOString().slice(0, 10), forModel: input.forModel, subject: w.subject, bodyTemplate: w.bodyTemplate };
    writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
    console.log(`${sub.subCode}: recorded (${sub.issues.length} issue${sub.issues.length === 1 ? "" : "s"})`);
    saved = true;
  }
  if (!saved) failed++;
}
console.log(failed ? `${failed} subcontractor(s) not recorded` : "all recorded");
if (provider === "anthropic") console.log(spendSummary());
process.exit(failed ? 1 : 0);
