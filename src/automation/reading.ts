import type { ExtractOutcome } from "@/ai/extractor";

type Recorded = { has(bytes: Uint8Array): boolean; extract(i: { bytes: Uint8Array; fileName: string }): Promise<ExtractOutcome> };

/** Reads a received PDF: its recorded reading when it is one of the fictional samples, otherwise the live extractor (AC-18.2). */
export function recordedOrLive(recorded: Recorded, live: (bytes: Uint8Array, fileName: string) => Promise<ExtractOutcome>) {
  return (bytes: Uint8Array, fileName: string): Promise<ExtractOutcome> => (recorded.has(bytes) ? recorded.extract({ bytes, fileName }) : live(bytes, fileName));
}
