import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { WriterInput } from "./issues";
import type { EmailWriter, WrittenEmail } from "./writer";

const Recording = z.object({
  recordedFrom: z.string().min(1),
  recordedOn: z.string(),
  forModel: z.unknown(),
  subject: z.string().min(1),
  bodyTemplate: z.string().min(1),
});

/**
 * Replays email wording recorded from a live Gemini run (samples/drafts, S-21). No AI calls.
 * A recording is used only when the writer input is exactly the one it was recorded for;
 * anything else throws, so draftEmail falls back to the code template. The result still
 * goes through placeholder filling and the post-check like any live draft.
 */
export class RecordedEmailWriter implements EmailWriter {
  private byInput = new Map<string, WrittenEmail>();

  constructor(recordings: z.infer<typeof Recording>[]) {
    for (const r of recordings) this.byInput.set(JSON.stringify(r.forModel), { subject: r.subject, bodyTemplate: r.bodyTemplate });
  }

  static fromDir(dir: string): RecordedEmailWriter {
    if (!existsSync(dir)) return new RecordedEmailWriter([]);
    const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    return new RecordedEmailWriter(files.map((f) => Recording.parse(JSON.parse(readFileSync(join(dir, f), "utf8")))));
  }

  get size(): number {
    return this.byInput.size;
  }

  async write(input: WriterInput["forModel"]): Promise<WrittenEmail> {
    const hit = this.byInput.get(JSON.stringify(input));
    if (!hit) throw new Error(`no recorded wording for ${input.subcontractor}`);
    return hit;
  }
}
