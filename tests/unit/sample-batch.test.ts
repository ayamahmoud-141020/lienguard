import { describe, expect, it } from "vitest";
import { copyFileSync, cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSampleBatch, type BatchStore } from "@/server/batches";
import type { BatchInput } from "@/pipeline/evaluate";

/** In-memory store with the same unique key as the DB: one document per (batchId, sha256). */
class MemoryBatchStore implements BatchStore {
  batches: { id: string; name: string; today: string; input: BatchInput }[] = [];
  documents = new Map<string, { batchId: string; fileName: string; sha256: string }>();
  async countBatches() {
    return this.batches.length;
  }
  async createBatch(b: { name: string; today: string; input: BatchInput }) {
    const id = `b${this.batches.length + 1}`;
    this.batches.push({ id, ...b });
    return id;
  }
  async upsertDocument(d: { batchId: string; fileName: string; sha256: string }) {
    const key = `${d.batchId}:${d.sha256}`;
    if (!this.documents.has(key)) this.documents.set(key, { batchId: d.batchId, fileName: d.fileName, sha256: d.sha256 });
  }
  docsOf(batchId: string) {
    return [...this.documents.values()].filter((d) => d.batchId === batchId);
  }
}

describe("S-9 sample batch creation (real logic, in-memory store)", () => {
  it("AC-9.1 creates a batch from samples/ and returns its id; calling again creates a separate batch", async () => {
    const store = new MemoryBatchStore();
    const a = await createSampleBatch(store, "samples", "2026-11-20");
    const b = await createSampleBatch(store, "samples", "2026-11-20");
    expect(a).not.toBe(b);
    expect(store.batches.map((x) => x.id)).toEqual([a, b]);
    const first = store.batches[0]!;
    expect(first.today).toBe("2026-11-20");
    expect(first.input.payments).toHaveLength(12);
    expect(first.input.subs).toHaveLength(6);
    expect(first.input.projects.map((p) => p.code).sort()).toEqual(["LKV", "PRK", "RVR"]);
    expect(store.docsOf(a)).toHaveLength(17);
    expect(store.docsOf(b)).toHaveLength(17);
  });

  it("AC-9.1 within a batch the same PDF bytes are stored once", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lg-samples-"));
    cpSync("samples", dir, { recursive: true });
    copyFileSync(join(dir, "pdfs", "W01-summit-air-RVR.pdf"), join(dir, "pdfs", "W01-duplicate-copy.pdf"));
    const store = new MemoryBatchStore();
    const id = await createSampleBatch(store, dir, "2026-11-20");
    expect(store.docsOf(id)).toHaveLength(17);
  });
});
