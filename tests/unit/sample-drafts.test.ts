import { afterEach, describe, expect, it, vi } from "vitest";
import { cpSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSampleBatch } from "@/server/batches";
import { GeminiEmailWriter } from "@/email/gemini-writer";
import { RecordedEmailWriter } from "@/email/recorded-writer";
import { buildSubIssues } from "@/email/issues";
import { postcheck } from "@/email/postcheck";
import { draftEmail } from "@/email/writer";
import { SAMPLE_DRAFTS_NOTE, emptyDraftsText, sampleDraftsNote } from "@/view/copy";
import { MemoryBatchStore } from "./memory-batch-store";

const recordingsDir = "samples/drafts";

describe("S-21 sample batches come with their emails ready", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("AC-21.1 a new sample batch has one follow-up per subcontractor on hold, from the recording, with zero AI calls", async () => {
    vi.stubEnv("LIENGUARD_AI", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "");
    const live = vi.spyOn(GeminiEmailWriter.prototype, "write");
    const store = new MemoryBatchStore();
    const id = await createSampleBatch(store, "samples", "2026-11-20");
    const subs = buildSubIssues(store.get(id).result!);
    const drafts = store.drafts.all().filter((d) => d.batchId === id);
    expect(subs).toHaveLength(6);
    expect(drafts.map((d) => d.subCode).sort()).toEqual(subs.map((s) => s.subCode).sort());
    expect(drafts.every((d) => d.source === "ai" && d.status === "draft")).toBe(true);
    expect(live).not.toHaveBeenCalled();
    // Filled and post-checked like a live draft: every amount and date is from the data, no placeholders left.
    for (const d of drafts) expect(postcheck(`${d.subject}\n${d.body}`, d.issues)).toEqual({ ok: true, problems: [] });
    // A second sample batch gets its own six; nothing is shared or duplicated.
    const id2 = await createSampleBatch(store, "samples", "2026-11-20");
    expect(store.drafts.all().filter((d) => d.batchId === id2)).toHaveLength(6);
    expect(store.drafts.all().filter((d) => d.batchId === id)).toHaveLength(6);
  });

  it("AC-21.1 every recording names the live model it came from and holds placeholders, not amounts or dates", () => {
    const files = readdirSync(recordingsDir).filter((f) => f.endsWith(".json"));
    expect(files).toHaveLength(6);
    for (const f of files) {
      const r = JSON.parse(readFileSync(join(recordingsDir, f), "utf8")) as { recordedFrom: string; bodyTemplate: string; subject: string };
      expect(r.recordedFrom).toMatch(/^(gemini|claude)-/);
      expect(`${r.subject}\n${r.bodyTemplate}`).not.toMatch(/\$\s?\d/);
      expect(r.bodyTemplate).toMatch(/\{\{[A-Z]+_\d+\}\}/);
    }
  });

  it("AC-21.2 a recording that does not match the batch, or that fails the post-check, falls back to the code template", async () => {
    const store = new MemoryBatchStore();
    const id = await createSampleBatch(store, "samples", "2026-11-20");
    const sub = buildSubIssues(store.get(id).result!)[0]!;
    // No recording for this input: the writer refuses and the code template is used.
    const empty = await draftEmail(new RecordedEmailWriter([]), sub);
    expect(empty.source).toBe("template");
    // A tampered recording with an invented amount is caught by the post-check.
    const dir = mkdtempSync(join(tmpdir(), "lg-drafts-"));
    cpSync("samples", dir, { recursive: true });
    for (const f of readdirSync(join(dir, "drafts"))) {
      const p = join(dir, "drafts", f);
      const r = JSON.parse(readFileSync(p, "utf8")) as { bodyTemplate: string };
      writeFileSync(p, JSON.stringify({ ...r, bodyTemplate: `${r.bodyTemplate}\nPlease also pay $99,999.00.` }));
    }
    const s2 = new MemoryBatchStore();
    const id2 = await createSampleBatch(s2, dir, "2026-11-20");
    const drafts = s2.drafts.all().filter((d) => d.batchId === id2);
    expect(drafts).toHaveLength(6);
    expect(drafts.every((d) => d.source === "template" && !d.body.includes("99,999"))).toBe(true);
  });

  it("AC-21.2 uploaded batches are created without drafts; the button still drafts them with the live writer", () => {
    const batches = readFileSync("src/server/batches.ts", "utf8");
    const upload = batches.slice(batches.indexOf("export async function createUploadBatch"), batches.indexOf("export async function addDocument"));
    expect(upload).not.toMatch(/generateDrafts|RecordedEmailWriter/);
    const route = readFileSync("src/app/api/batches/[id]/drafts/route.ts", "utf8");
    expect(route).toMatch(/generateDrafts\(id, batch\.result, getWriter\(\)/);
  });

  it("AC-21.3 the 'recorded from Gemini' note shows only on sample batches whose follow-ups all came from the recording", () => {
    expect(SAMPLE_DRAFTS_NOTE).toBe("Sample emails were recorded from live AI runs (Gemini and Claude).");
    // The note names exactly the providers that wrote the recordings, no more and no less.
    const providers = new Set(
      readdirSync(recordingsDir).map((f) => (JSON.parse(readFileSync(join(recordingsDir, f), "utf8")) as { recordedFrom: string }).recordedFrom.split("-")[0]),
    );
    expect([...providers].sort()).toEqual(["claude", "gemini"]);
    expect(sampleDraftsNote("sample", [{ source: "ai", kind: "followup" }])).toBe(SAMPLE_DRAFTS_NOTE);
    expect(sampleDraftsNote("upload", [{ source: "ai", kind: "followup" }])).toBeNull();
    expect(sampleDraftsNote("sample", [{ source: "template", kind: "followup" }])).toBeNull();
    expect(sampleDraftsNote("sample", [{ source: "ai", kind: "reminder" }])).toBeNull();
    expect(sampleDraftsNote("sample", [])).toBeNull();
    expect(sampleDraftsNote("sample", [{ source: "ai", kind: "followup" }, { source: "template", kind: "followup" }])).toBeNull();
    expect(sampleDraftsNote("sample", [{ source: "ai", kind: "followup" }, { source: "template", kind: "reminder" }])).toBe(SAMPLE_DRAFTS_NOTE);
    expect(readFileSync("src/app/batches/[id]/drafts/page.tsx", "utf8")).toMatch(/sampleDraftsNote\(batch\.kind, drafts\)/);
  });

  it("AC-21.4 an empty Emails page names the batch and says where earlier emails are", () => {
    const t = emptyDraftsText("Uploaded batch · March");
    expect(t).toContain("Uploaded batch · March has no emails yet");
    expect(t).toMatch(/Each batch has its own emails/);
    expect(t).toMatch(/under Batches/);
    expect(t).toMatch(/review each before anything is sent/);
    expect(readFileSync("src/app/batches/[id]/drafts/page.tsx", "utf8")).toMatch(/emptyDraftsText\(batch\.name\)/);
  });
});
