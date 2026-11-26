import type { ExtractOutcome } from "@/ai/extractor";

/** Shown on sample batches and in the README (AC-16.1). Must stay true: the fixtures are hand-checked, not Gemini output. */
export const SAMPLE_NOTE =
  "Sample data uses hand-checked readings, so results are the same every time. A live Gemini run matched them on 105 of 106 fields. Upload your own PDFs to see live extraction.";

/** Shown when the AI provider's free quota ran out (AC-16.3). */
export const QUOTA_NOTICE = "AI quota reached, try later. Documents that couldn't be read are on hold, never passed.";

export function quotaNotice(outcomes: ExtractOutcome[]): string | null {
  return outcomes.some((o) => !o.ok && o.code === "quota") ? QUOTA_NOTICE : null;
}
