import { describe, expect, it } from "vitest";
import { copyFileSync, cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSampleBatch } from "@/server/batches";
import { MemoryBatchStore } from "./memory-batch-store";

describe("S-9 sample batch creation (real logic, in-memory store)", () => {
  it("AC-9.1 creates a batch from samples/ and returns its id; calling again creates a separate batch", async () => {
    const store = new MemoryBatchStore();
    const a = await createSampleBatch(store, "samples", "2026-11-20");
    const b = await createSampleBatch(store, "samples", "2026-11-20");
    expect(a).not.toBe(b);
    expect(store.batches.map((x) => x.id)).toEqual([a, b]);
    const first = store.get(a);
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
