import { requirePasscode } from "@/server/guard";
import { addDocument } from "@/server/batches";
import { readUpload } from "@/server/uploads";

export const runtime = "nodejs";

/** One PDF per request (keeps each request under the hosting body-size limit). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  const { id } = await params;
  const form = await req.formData();
  const file = await readUpload(form.get("file"), "pdf");
  if (!file.ok) return Response.json({ error: file.error }, { status: 400 });
  await addDocument(id, file.name, file.bytes);
  return Response.json({ ok: true });
}
