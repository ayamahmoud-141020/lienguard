import { z } from "zod/v4";
import { geminiGenerate, toGeminiSchema, type GenerateFn } from "@/ai/gemini";
import { WRITER_SYSTEM_PROMPT, writerUserPrompt } from "./anthropic-writer";
import type { WriterInput } from "./issues";
import type { EmailWriter, WrittenEmail } from "./writer";

const Output = z.object({ subject: z.string().min(1), bodyTemplate: z.string().min(1) });
const SCHEMA = toGeminiSchema(z.toJSONSchema(Output) as Record<string, unknown>);

/** Same prompt and contract as AnthropicEmailWriter: wording only, placeholders for numbers. ADR-0007. */
export class GeminiEmailWriter implements EmailWriter {
  constructor(
    private generate: GenerateFn,
    private model: string,
  ) {}

  static fromApiKey(apiKey: string, model: string, maxConcurrency: number): GeminiEmailWriter {
    return new GeminiEmailWriter(geminiGenerate(apiKey, maxConcurrency), model);
  }

  async write(input: WriterInput["forModel"], feedback?: string): Promise<WrittenEmail> {
    const res = await this.generate({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: writerUserPrompt(input, feedback) }] }],
      config: { systemInstruction: WRITER_SYSTEM_PROMPT, responseMimeType: "application/json", responseJsonSchema: SCHEMA },
    });
    if (!res.text) throw new Error("the model did not return a usable draft");
    return Output.parse(JSON.parse(res.text));
  }
}
