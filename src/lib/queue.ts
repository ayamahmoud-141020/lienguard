export type QueueStatus = "queued" | "reading" | "done" | "needs review";

/**
 * Runs one task per id with at most `limit` in flight (used by the processing
 * screen: one extraction request per PDF, to stay inside serverless limits).
 * A task that throws is reported as "needs review", never dropped.
 */
export async function runQueue(
  ids: string[],
  limit: number,
  task: (id: string) => Promise<"done" | "needs review">,
  onStatus: (id: string, status: QueueStatus) => void,
): Promise<void> {
  ids.forEach((id) => onStatus(id, "queued"));
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++] as string;
      onStatus(id, "reading");
      let status: "done" | "needs review";
      try {
        status = await task(id);
      } catch {
        status = "needs review";
      }
      onStatus(id, status);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, ids.length) }, worker));
}
