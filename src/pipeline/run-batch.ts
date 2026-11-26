import type { Extractor } from "@/ai/extractor";
import { evaluateBatch, type BatchInput, type BatchResult, type ExtractedDocument } from "./evaluate";

export type InputDocument = { id: string; fileName: string; bytes: Uint8Array };

/** Runs async tasks with at most `limit` in flight, keeping result order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Full pipeline in one process (tests, scripts). The web app runs extraction per request instead. */
export async function runBatch(
  input: BatchInput & { documents: InputDocument[] },
  extractor: Extractor,
  today: string,
): Promise<BatchResult> {
  const extracted: ExtractedDocument[] = await mapLimit(input.documents, 4, async (d) => ({
    id: d.id,
    fileName: d.fileName,
    outcome: await extractor.extract({ bytes: d.bytes, fileName: d.fileName }),
  }));
  return evaluateBatch(input, extracted, today);
}
