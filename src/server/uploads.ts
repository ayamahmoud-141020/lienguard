export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type UploadKind = "pdf" | "xlsx";

/** Checks magic bytes (not just the extension) and the size limit. */
export function checkUpload(bytes: Uint8Array, kind: UploadKind): { ok: true } | { ok: false; error: string } {
  if (bytes.byteLength === 0) return { ok: false, error: "empty file" };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { ok: false, error: "file is larger than 4 MB" };
  const head = Buffer.from(bytes.subarray(0, 5)).toString("latin1");
  if (kind === "pdf" && head !== "%PDF-") return { ok: false, error: "not a PDF file" };
  if (kind === "xlsx" && !head.startsWith("PK")) return { ok: false, error: "not an .xlsx file" };
  return { ok: true };
}

export async function readUpload(file: FormDataEntryValue | null, kind: UploadKind): Promise<{ ok: true; bytes: Uint8Array; name: string } | { ok: false; error: string }> {
  if (!file || typeof file === "string") return { ok: false, error: `missing ${kind} file` };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "file is larger than 4 MB" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(bytes, kind);
  return check.ok ? { ok: true, bytes, name: file.name.replace(/[^\w.\- ]/g, "_").slice(0, 120) } : check;
}
