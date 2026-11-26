import { sha256 } from "@/ai/hash";

/** Keeps the first file for each unique content hash (idempotent uploads). */
export function dedupeDocuments<T extends { fileName: string; bytes: Uint8Array }>(files: T[]): (T & { sha256: string })[] {
  const seen = new Set<string>();
  const out: (T & { sha256: string })[] = [];
  for (const f of files) {
    const h = sha256(f.bytes);
    if (seen.has(h)) continue;
    seen.add(h);
    out.push({ ...f, sha256: h });
  }
  return out;
}
