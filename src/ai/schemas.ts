import { z } from "zod/v4";

/** Every extracted value carries how sure the model is and the exact words it read. */
const field = <T extends z.ZodType>(t: T) =>
  z.object({
    value: t.nullable(),
    confidence: z.number().min(0).max(1),
    sourceText: z.string(),
  });

export const WaiverFields = z.object({
  claimantName: field(z.string()),
  customerName: field(z.string()),
  projectName: field(z.string()),
  type: field(z.enum(["conditional", "unconditional"])),
  scope: field(z.enum(["progress", "final"])),
  /** Raw text as written, e.g. "$18,000.00". Code parses it (ADR-0002). */
  amount: field(z.string()),
  /** Raw text as written. Code parses it. */
  throughDate: field(z.string()),
  signed: field(z.boolean()),
  notarized: field(z.boolean()),
  exceptions: field(z.string()),
});

export const CoiFields = z.object({
  insuredName: field(z.string()),
  certificateHolder: field(z.string()),
  /** General liability policy expiry, raw text as written. */
  glExpiry: field(z.string()),
});

export const Extraction = z.object({
  kind: z.enum(["waiver", "coi", "unknown"]),
  waiver: WaiverFields.nullable(),
  coi: CoiFields.nullable(),
  /** Anything odd about the document, e.g. instructions embedded in its text. */
  notes: z.string(),
});

export type ExtractionT = z.infer<typeof Extraction>;
export type FieldT<T> = { value: T | null; confidence: number; sourceText: string };
