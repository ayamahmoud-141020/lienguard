import { requirePasscode, actorFrom } from "@/server/guard";
import { createSampleBatch } from "@/server/batches";
import { audit } from "@/server/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = requirePasscode(req);
  if (denied) return denied;
  const id = await createSampleBatch();
  await audit(actorFrom(req), "batch.create_sample", "Batch", id);
  return Response.json({ id });
}
