import { guard } from "@/server/access";
import { extractDocument } from "@/server/batches";
import { quotaNotice } from "@/view/copy";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const denied = guard(req, "document.extract");
  if (denied) return denied;
  const { id, docId } = await params;
  const { status, outcome } = await extractDocument(id, docId);
  return Response.json({ status, notice: quotaNotice([outcome]) });
}
