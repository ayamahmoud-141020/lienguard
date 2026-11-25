import { requirePasscode, actorFrom } from "@/server/guard";
import { evaluateStoredBatch } from "@/server/batches";
import { audit } from "@/server/audit";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  const { id } = await params;
  const result = await evaluateStoredBatch(id);
  await audit(actorFrom(req), "batch.evaluate", "Batch", id, { exposedCents: result.exposedCents, hold: result.counts.hold });
  return Response.json({ ok: true });
}
