import { z } from "zod/v4";
import { Extraction } from "./schemas";
import { EXTRACT_SYSTEM_PROMPT, EXTRACT_USER_PROMPT } from "./prompts";
import { geminiGenerate, statusOf, toGeminiSchema, type GenerateFn } from "./gemini";
import type { ExtractInput, ExtractOutcome, Extractor } from "./extractor";

const MAX_ATTEMPTS = 2;
const SCHEMA = toGeminiSchema(z.toJSONSchema(Extraction) as Record<string, unknown>);

/**
 * Same contract as AnthropicExtractor: one call per PDF, structured JSON output,
 * re-validated with our Zod schema; one retry on invalid output, else needsReview. ADR-0007.
 */
export class GeminiExtractor implements Extractor {
  constructor(
    private generate: GenerateFn,
    private model: string,
  ) {}

  static fromApiKey(apiKey: string, model: string, maxConcurrency: number): GeminiExtractor {
    return new GeminiExtractor(geminiGenerate(apiKey, maxConcurrency), model);
  }

  async extract({ bytes }: ExtractInput): Promise<ExtractOutcome> {
    const data = Buffer.from(bytes).toString("base64");
    let lastError = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const text = attempt === 1 ? EXTRACT_USER_PROMPT : `${EXTRACT_USER_PROMPT}\nYour previous answer failed validation: ${lastError}. Return output that matches the schema.`;
      let answer: string | undefined;
      try {
        const res = await this.generate({
          model: this.model,
          contents: [{ role: "user", parts: [{ inlineData: { mimeType: "application/pdf", data } }, { text }] }],
          config: { systemInstruction: EXTRACT_SYSTEM_PROMPT, responseMimeType: "application/json", responseJsonSchema: SCHEMA, temperature: 0 },
        });
        answer = res.text;
      } catch (e) {
        if (statusOf(e) === 429) {
          // Backoff already waited; a quota error now is not worth a second full attempt.
          return { ok: false, code: "quota", reason: "could not read the document reliably (the AI provider's rate limit or daily quota was reached; try again later)" };
        }
        lastError = e instanceof Error ? e.message.slice(0, 300) : "request failed";
        continue;
      }
      if (!answer) {
        lastError = "empty or blocked response";
        continue;
      }
      let json: unknown;
      try {
        json = JSON.parse(answer);
      } catch {
        lastError = "the answer was not valid JSON";
        continue;
      }
      const parsed = Extraction.safeParse(json);
      if (parsed.success) return { ok: true, extraction: parsed.data };
      lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 300);
    }
    return { ok: false, reason: `could not read the document reliably (${lastError || "invalid output"})` };
  }
}
