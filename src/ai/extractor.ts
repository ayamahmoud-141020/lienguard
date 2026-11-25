import type { ExtractionT } from "./schemas";

export type ExtractInput = { bytes: Uint8Array; fileName: string };

/** ok:false means the document could not be read reliably → needsReview. */
export type ExtractOutcome = { ok: true; extraction: ExtractionT } | { ok: false; reason: string };

/** Reads one document. Implementations: Anthropic (live) and Fixture (tests/CI). ADR-0003. */
export interface Extractor {
  extract(input: ExtractInput): Promise<ExtractOutcome>;
}

export const UNKNOWN_EXTRACTION: ExtractionT = { kind: "unknown", waiver: null, coi: null, notes: "no fixture for this file" };
