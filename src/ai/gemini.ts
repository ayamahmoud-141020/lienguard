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

/** A counting gate: at most `max` tasks run at once; the rest wait in order. */
class Gate {
  private running = 0;
  private waiting: (() => void)[] = [];
  constructor(private max: number) {}
  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.max) await new Promise<void>((r) => this.waiting.push(r));
    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      this.waiting.shift()?.();
    }
  }
}

/** At most `max` calls in flight through this wrapper (or through `gate`, if several wrappers share one). */
export function limitConcurrency(fn: GenerateFn, max: number, gate: Gate = new Gate(max)): GenerateFn {
  return (req) => gate.run(() => fn(req));
}

/** One gate per server instance (module scope), shared by every client built per request. */
const instanceGates = new Map<number, Gate>();
function instanceGate(max: number): Gate {
  let g = instanceGates.get(max);
  if (!g) instanceGates.set(max, (g = new Gate(max)));
  return g;
}

/**
 * Real client: SDK call → per-instance concurrency limit → backoff on 429/503/network drops.
 * `call` is injectable so tests can check the wiring without network.
 */
export function geminiGenerate(apiKey: string, maxConcurrency: number, call: GenerateFn = sdkCall(apiKey)): GenerateFn {
  return withBackoff(limitConcurrency(call, maxConcurrency, instanceGate(maxConcurrency)));
}

function sdkCall(apiKey: string): GenerateFn {
  const ai = new GoogleGenAI({ apiKey });
  return async (req) => {
    const res = await ai.models.generateContent({ model: req.model, contents: req.contents as never, config: req.config as never });
    return { text: res.text };
  };
}

/** Gemini's JSON-schema subset doesn't need the `$schema` marker. */
export function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...schema };
  delete rest.$schema;
  return rest;
}
