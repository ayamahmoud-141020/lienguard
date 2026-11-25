import { sha256 } from "./hash";
import { UNKNOWN_EXTRACTION, type ExtractInput, type ExtractOutcome, type Extractor } from "./extractor";
import type { ExtractionT } from "./schemas";

/** Returns pre-recorded extractions keyed by file hash. Used in tests and CI (no network). */
export class FixtureExtractor implements Extractor {
  constructor(private fixtures: Map<string, ExtractionT>) {}

  async extract({ bytes }: ExtractInput): Promise<ExtractOutcome> {
    return { ok: true, extraction: this.fixtures.get(sha256(bytes)) ?? UNKNOWN_EXTRACTION };
  }
}
