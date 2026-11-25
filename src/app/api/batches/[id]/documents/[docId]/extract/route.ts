import { requirePasscode } from "@/server/guard";
import { extractDocument } from "@/server/batches";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  const { id, docId } = await params;
  const status = await extractDocument(id, docId);
  return Response.json({ status });
}
