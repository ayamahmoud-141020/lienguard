import { actorFrom } from "@/server/guard";
import { guard } from "@/server/access";
import { getBatchView } from "@/server/batches";
import { getWriter, prismaDraftStore } from "@/server/drafts";
import { generateDrafts } from "@/email/workflow";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(req, "drafts.generate");
  if (denied) return denied;
  const { id } = await params;
  const batch = await getBatchView(id);
  if (!batch?.result) return Response.json({ error: "Batch has no results yet" }, { status: 400 });
  const created = await generateDrafts(id, batch.result, getWriter(), prismaDraftStore);
  await audit(actorFrom(req), "email.generate_drafts", "Batch", id, { created });
  return Response.json({ created });
}
