import { receiveDocument } from "@/automation/engine";
import { guard } from "@/server/access";
import { actorFrom, hasPasscode } from "@/server/guard";
import { SAMPLE_REPLY, automationDeps, prismaAutomationStore } from "@/server/automation";

export const runtime = "nodejs";

/**
 * "Simulate a subcontractor reply" on a sample batch (AC-18.4): the corrected BlueLine waiver goes through the
 * same path as /api/inbound. Open to everyone; the AP email is only sent when demo access is unlocked.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(req, "batch.simulate_reply");
  if (denied) return denied;
  const { id } = await params;
  const store = prismaAutomationStore;
  const batch = await store.loadBatch(id);
  if (!batch) return Response.json({ error: "batch not found" }, { status: 404 });
  if (batch.kind !== "sample") return Response.json({ error: "The simulated reply only works on sample batches." }, { status: 400 });
  const notify = hasPasscode(req);
  const r = await receiveDocument(store, automationDeps(), { batchId: id, fileName: SAMPLE_REPLY.fileName, bytes: SAMPLE_REPLY.bytes(), actor: actorFrom(req), notify });
  return Response.json({ ...r, notified: notify });
}
