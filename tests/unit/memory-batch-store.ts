import type { BatchStore, StoredDocument } from "@/server/batches";
import type { BatchInput, BatchResult } from "@/pipeline/evaluate";

type MemBatch = { id: string; name: string; today: string; kind: string; input: BatchInput; status: string; result?: BatchResult; createdAt: Date };

/** In-memory BatchStore with the same unique key as the DB: one document per (batchId, sha256). */
export class MemoryBatchStore implements BatchStore {
  batches: MemBatch[] = [];
  documents = new Map<string, StoredDocument & { id: string; batchId: string }>();
  private seq = 0;

  async countBatches(kind: string) {
    return this.batches.filter((b) => b.kind === kind).length;
  }
  async createBatch(b: { name: string; today: string; kind: string; input: BatchInput }) {
    const id = `b${++this.seq}`;
    this.batches.push({ id, ...b, status: "processing", createdAt: new Date(2026, 10, 26, 0, this.seq) });
    return id;
  }
  async addDocument(d: StoredDocument & { batchId: string }) {
    const key = `${d.batchId}:${d.sha256}`;
    const existing = this.documents.get(key);
    if (existing) return existing.id;
    const id = `d${++this.seq}`;
    this.documents.set(key, { ...d, id });
    return id;
  }
  async finishReady(batchId: string, result: BatchResult) {
    const b = this.get(batchId);
    b.status = "ready";
    b.result = result;
  }
  async listBatches() {
    return this.batches.map(({ id, kind, createdAt }) => ({ id, kind, createdAt }));
  }
  async deleteBatches(ids: string[]) {
    this.batches = this.batches.filter((b) => !ids.includes(b.id));
    for (const [k, d] of this.documents) if (ids.includes(d.batchId)) this.documents.delete(k);
  }
  get(id: string): MemBatch {
    const b = this.batches.find((x) => x.id === id);
    if (!b) throw new Error(`no batch ${id}`);
    return b;
  }
  docsOf(batchId: string) {
    return [...this.documents.values()].filter((d) => d.batchId === batchId);
  }
}
