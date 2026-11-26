import { toDocument } from "@/ai/to-document";
import type { ExtractOutcome } from "@/ai/extractor";

/** A processing batch with no progress for this long is finished on the next view (AC-13.3). */
export const STALE_MS = 3 * 60 * 1000;

export type BatchState = { status: string; updatedAt: Date; docStatuses: string[] };

/** What to do with a batch when it is viewed. Pure: `now` is passed in. */
export function nextBatchAction(b: BatchState, now: Date): "none" | "evaluate" | "wait" {
  if (b.status !== "processing") return "none";
  if (b.docStatuses.length > 0 && !b.docStatuses.includes("queued")) return "evaluate";
  if (b.docStatuses.length > 0 && now.getTime() - b.updatedAt.getTime() > STALE_MS) return "evaluate";
  return "wait";
}

/** Reads one document; a thrown error becomes needs_review with the reason, never a stuck `queued` (AC-13.2). */
export async function readDocument(
  read: () => Promise<ExtractOutcome>,
  meta: { documentId: string; fileName: string },
): Promise<{ outcome: ExtractOutcome; status: "done" | "needs_review" }> {
  let outcome: ExtractOutcome;
  try {
    outcome = await read();
  } catch (e) {
    outcome = { ok: false, reason: `could not read the document (${e instanceof Error ? e.message.slice(0, 200) : "error"})` };
  }
  const review = !outcome.ok || toDocument(outcome.extraction, meta).needsReview;
  return { outcome, status: review ? "needs_review" : "done" };
}

/** Runs the rules; if that throws, the batch is marked failed with a message people can read (AC-13.4). */
export async function finishBatch(
  batchId: string,
  evaluate: (id: string) => Promise<unknown>,
  markFailed: (id: string, message: string) => Promise<void>,
): Promise<"ready" | "failed"> {
  try {
    await evaluate(batchId);
    return "ready";
  } catch (e) {
    await markFailed(batchId, `Could not apply the rules: ${e instanceof Error ? e.message.slice(0, 200) : "unknown error"}`);
    return "failed";
  }
}

/** Sample batches beyond the newest `keep` (AC-14.2). Uploaded batches are never returned. */
export function samplesToDelete(batches: { id: string; kind: string; createdAt: Date }[], keep: number): string[] {
  return batches
    .filter((b) => b.kind === "sample")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(keep)
    .map((b) => b.id);
}
