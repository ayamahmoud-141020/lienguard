import type { ExtractInput, ExtractOutcome, Extractor } from "./extractor";
import { groundExtraction } from "./grounding";
import { pdfText } from "./pdf-text";

/**
 * Wraps any reader so every value it returns is checked against the PDF's own text (R-23).
 * Put it outside the extraction cache, so cached readings are checked too (AC-24.7).
 */
export class GroundedExtractor implements Extractor {
  constructor(
    private inner: Extractor,
    private readText: (bytes: Uint8Array) => Promise<string> = pdfText,
  ) {}

  async extract(input: ExtractInput): Promise<ExtractOutcome> {
    const outcome = await this.inner.extract(input);
    if (!outcome.ok) return outcome;
    return { ok: true, extraction: groundExtraction(outcome.extraction, await this.readText(input.bytes)) };
  }
}

/** The same check for readers shaped as (bytes, fileName) => outcome, as the automation uses. */
export function groundedRead(read: (bytes: Uint8Array, fileName: string) => Promise<ExtractOutcome>) {
  const g = new GroundedExtractor({ extract: ({ bytes, fileName }) => read(bytes, fileName) });
  return (bytes: Uint8Array, fileName: string): Promise<ExtractOutcome> => g.extract({ bytes, fileName });
}
