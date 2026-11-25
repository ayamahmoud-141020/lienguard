import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Extraction } from "./schemas";
import { EXTRACT_SYSTEM_PROMPT, EXTRACT_USER_PROMPT } from "./prompts";
import type { ExtractInput, ExtractOutcome, Extractor } from "./extractor";

export type ParseRequest = Parameters<Anthropic["messages"]["parse"]>[0];
export type ParseFn = (req: ParseRequest) => Promise<{ stop_reason: string | null; parsed_output: unknown }>;

const MAX_ATTEMPTS = 2;

/**
 * One call per PDF (document block + structured output). The model's answer is
 * re-validated with our own Zod schema; one retry on invalid output, else needsReview.
 */
export class AnthropicExtractor implements Extractor {
  constructor(
    private parse: ParseFn,
    private model: string,
  ) {}

  static fromApiKey(apiKey: string, model: string): AnthropicExtractor {
    const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 120_000 });
    return new AnthropicExtractor((req) => client.messages.parse(req), model);
  }

  async extract({ bytes }: ExtractInput): Promise<ExtractOutcome> {
    const data = Buffer.from(bytes).toString("base64");
    let lastError = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const text = attempt === 1 ? EXTRACT_USER_PROMPT : `${EXTRACT_USER_PROMPT}\nYour previous answer failed validation: ${lastError}. Return output that matches the schema.`;
      let res: Awaited<ReturnType<ParseFn>>;
      try {
        res = await this.parse({
          model: this.model,
          max_tokens: 8000,
          system: EXTRACT_SYSTEM_PROMPT,
          output_config: { effort: "low", format: zodOutputFormat(Extraction) },
          messages: [
            {
              role: "user",
              content: [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
                { type: "text", text },
              ],
            },
          ],
        });
      } catch (e) {
        lastError = e instanceof Error ? e.message.slice(0, 300) : "request failed";
        continue;
      }
      if (res.stop_reason === "refusal") return { ok: false, reason: "the model declined to read this document" };
      const parsed = Extraction.safeParse(res.parsed_output);
      if (parsed.success) return { ok: true, extraction: parsed.data };
      lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 300);
    }
    return { ok: false, reason: `could not read the document reliably (${lastError || "invalid output"})` };
  }
}
