import type { AutomationStore, StoredDoc, StoredDraft } from "@/automation/engine";
import type { BatchInput, BatchResult } from "@/pipeline/evaluate";
import type { SubIssues } from "@/email/issues";

type Batch = { id: string; name: string; kind: string; status: string; today: string; input: BatchInput; result: BatchResult | null };

/** In-memory AutomationStore for tests: same rules as the DB (one document per batch + sha256). */
export class MemoryAutomationStore implements AutomationStore {
  batches = new Map<string, Batch>();
  docs = new Map<string, StoredDoc & { batchId: string }>();
  drafts: (StoredDraft & { batchId: string })[] = [];
  events: { batchId: string; actor: string; action: string; details: Record<string, unknown> }[] = [];
  private seq = 0;

  async loadBatch(id: string) {
    return this.batches.get(id) ?? null;
  }
  async listReadyBatchIds() {
    return [...this.batches.values()].filter((b) => b.status === "ready").map((b) => b.id);
  }
  async listDocuments(batchId: string) {
    return [...this.docs.values()].filter((d) => d.batchId === batchId);
  }
  async addDocument(batchId: string, d: Omit<StoredDoc, "id">) {
    const existing = [...this.docs.values()].find((x) => x.batchId === batchId && x.sha256 === d.sha256);
    if (existing) return { id: existing.id, duplicate: true };
    const id = `doc${++this.seq}`;
    this.docs.set(id, { ...d, id, batchId });
    return { id, duplicate: false };
  }
  async saveResult(batchId: string, today: string, result: BatchResult) {
    const b = this.batches.get(batchId);
    if (b) Object.assign(b, { today, result, status: "ready" });
  }
  async listDrafts(batchId: string) {
    return this.drafts.filter((d) => d.batchId === batchId);
  }
  async createReminder(batchId: string, sub: SubIssues, subject: string, body: string) {
    const id = `rem${++this.seq}`;
    this.drafts.push({ id, batchId, subCode: sub.subCode, kind: "reminder", status: "draft", sentOn: null, subject, body });
    return id;
  }
  async event(batchId: string, actor: string, action: string, details: Record<string, unknown> = {}) {
    this.events.push({ batchId, actor, action, details });
  }
}
