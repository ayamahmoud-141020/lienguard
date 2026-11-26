import { actorFrom } from "@/server/guard";
import { guard } from "@/server/access";
import { createUploadBatch } from "@/server/batches";
import { readUpload } from "@/server/uploads";
import { audit } from "@/server/audit";

export const runtime = "nodejs";

/** Creates a batch from the two spreadsheets. PDFs are uploaded one per request afterwards. */
export async function POST(req: Request) {
  const denied = guard(req, "batch.upload");
  if (denied) return denied;
  const form = await req.formData();
  const payments = await readUpload(form.get("payments"), "xlsx");
  const subs = await readUpload(form.get("subcontractors"), "xlsx");
  if (!payments.ok) return Response.json({ error: `payments.xlsx: ${payments.error}` }, { status: 400 });
  if (!subs.ok) return Response.json({ error: `subcontractors.xlsx: ${subs.error}` }, { status: 400 });
  const name = String(form.get("name") ?? "").slice(0, 80);
  const { id, errors } = await createUploadBatch(name, payments.bytes, subs.bytes);
  if (!id) return Response.json({ error: "No valid payment rows", rowErrors: errors }, { status: 400 });
  await audit(actorFrom(req), "batch.create_upload", "Batch", id, { rowErrors: errors.length });
  return Response.json({ id, rowErrors: errors });
}
