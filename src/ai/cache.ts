import { sha256 } from "./hash";
import type { ExtractInput, ExtractOutcome, Extractor } from "./extractor";
import type { ExtractionT } from "./schemas";

export interface ExtractionCache {
  get(sha: string): Promise<ExtractionT | null>;
  set(sha: string, extraction: ExtractionT): Promise<void>;
}

/** Same bytes are never sent to the model twice (ADR-0004). Failures are not cached, so they can be retried. */
export async function cachedExtract(inner: Extractor, cache: ExtractionCache, input: ExtractInput): Promise<ExtractOutcome> {
  const key = sha256(input.bytes);
  const hit = await cache.get(key);
  if (hit) return { ok: true, extraction: hit };
  const outcome = await inner.extract(input);
  if (outcome.ok) await cache.set(key, outcome.extraction);
  return outcome;
}
