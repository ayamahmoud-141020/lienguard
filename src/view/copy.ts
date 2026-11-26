import type { ExtractOutcome } from "@/ai/extractor";

/** Shown on sample batches and in the README (AC-16.1). Must stay true: the fixtures are hand-checked, not Gemini output. */
export const SAMPLE_NOTE =
  "Sample data uses hand-checked readings, so results are the same every time. Live runs of Claude (claude-opus-5-5) and Gemini each matched them on 105 of 106 fields. Upload your own PDFs to see live extraction.";

/** Shown when the AI provider's free quota ran out (AC-16.3). */
export const QUOTA_NOTICE = "AI quota reached, try later. Documents that couldn't be read are on hold, never passed.";

export function quotaNotice(outcomes: ExtractOutcome[]): string | null {
  return outcomes.some((o) => !o.ok && o.code === "quota") ? QUOTA_NOTICE : null;
}

/** Shown above a sample batch's emails (AC-21.3). Must name exactly the providers whose models wrote samples/drafts (a test checks it). */
export const SAMPLE_DRAFTS_NOTE = "Sample emails were recorded from live AI runs (Gemini and Claude).";

/** Empty Emails page (AC-21.4): says why it is empty and where earlier emails are. */
export function emptyDraftsText(batchName: string): string {
  return `${batchName} has no emails yet. Each batch has its own emails: draft this one's below, one per subcontractor with a payment on hold, and review each before anything is sent. Emails you drafted earlier stay with their own batch under Batches.`;
}

/** The note shows only on sample batches whose follow-ups ALL came from the recording (source "ai"). */
export function sampleDraftsNote(batchKind: string, drafts: { source: string; kind?: string }[]): string | null {
  const followups = drafts.filter((d) => d.kind !== "reminder");
  return batchKind === "sample" && followups.length > 0 && followups.every((d) => d.source === "ai") ? SAMPLE_DRAFTS_NOTE : null;
}
