import { actorFrom } from "@/server/guard";
import { guard } from "@/server/access";
import { evaluateStoredBatch } from "@/server/batches";
import { audit } from "@/server/audit";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(req, "batch.evaluate");
  if (denied) return denied;
  const { id } = await params;
  const result = await evaluateStoredBatch(id);
  await audit(actorFrom(req), "batch.evaluate", "Batch", id, { exposedCents: result.exposedCents, hold: result.counts.hold });
  return Response.json({ ok: true });
}
