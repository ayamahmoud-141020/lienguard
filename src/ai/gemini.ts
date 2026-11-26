import { GoogleGenAI } from "@google/genai";

/** The slice of `ai.models.generateContent` we use. Faked in tests (no network in CI). */
export type GeminiRequest = { model: string; contents: unknown; config: Record<string, unknown> };
export type GenerateFn = (req: GeminiRequest) => Promise<{ text: string | undefined }>;
export type Sleep = (ms: number) => Promise<void>;

const realSleep: Sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function statusOf(e: unknown): number | undefined {
  const s = (e as { status?: unknown } | null)?.status;
  return typeof s === "number" ? s : undefined;
}

/** Retries rate limits (429) and overload (503) with exponential backoff. Other errors fail at once. */
export function withBackoff(fn: GenerateFn, opts: { retries?: number; baseMs?: number; sleep?: Sleep } = {}): GenerateFn {
  const { retries = 4, baseMs = 2000, sleep = realSleep } = opts;
  return async (req) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn(req);
      } catch (e) {
        const status = statusOf(e);
        // Network drops (no HTTP status, "fetch failed") are transient too.
        const transient = status === 429 || status === 503 || (status === undefined && /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(String((e as Error)?.message ?? "") + String((e as { cause?: unknown })?.cause ?? "")));
        if (attempt >= retries || !transient) throw e;
        await sleep(baseMs * 2 ** attempt);
      }
    }
  };
}

/** At most `max` calls in flight (per server instance). Free-tier limits are per minute, so keep this small. */
export function limitConcurrency(fn: GenerateFn, max: number): GenerateFn {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async (req) => {
    if (running >= max) await new Promise<void>((r) => waiting.push(r));
    running++;
    try {
      return await fn(req);
    } finally {
      running--;
      waiting.shift()?.();
    }
  };
}

/** Real client: SDK call → concurrency limit → backoff on 429/503. */
export function geminiGenerate(apiKey: string, maxConcurrency: number): GenerateFn {
  const ai = new GoogleGenAI({ apiKey });
  const call: GenerateFn = async (req) => {
    const res = await ai.models.generateContent({ model: req.model, contents: req.contents as never, config: req.config as never });
    return { text: res.text };
  };
  return withBackoff(limitConcurrency(call, maxConcurrency));
}

/** Gemini's JSON-schema subset doesn't need the `$schema` marker. */
export function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...schema };
  delete rest.$schema;
  return rest;
}
