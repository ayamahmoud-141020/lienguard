import { actorFrom } from "@/server/guard";
import { guard } from "@/server/access";
import { createSampleBatch } from "@/server/batches";
import { audit } from "@/server/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = guard(req, "batch.sample");
  if (denied) return denied;
  const id = await createSampleBatch();
  await audit(actorFrom(req), "batch.create_sample", "Batch", id);
  return Response.json({ id });
}
