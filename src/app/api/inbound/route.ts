import { receiveDocument } from "@/automation/engine";
import { automationDeps, prismaAutomationStore, requireInboundSecret } from "@/server/automation";
import { readUpload } from "@/server/uploads";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * A document forwarded from the AP inbox (AC-18.1/18.2): x-inbound-secret header, form fields batchId + file (one PDF).
 * Reads it, re-checks the batch, records what changed and notifies the AP inbox when a payment becomes safe.
 */
export async function POST(req: Request) {
  const denied = requireInboundSecret(req);
  if (denied) return denied;
  const form = await req.formData();
  const batchId = form.get("batchId");
  if (typeof batchId !== "string" || !batchId) return Response.json({ error: "batchId is required" }, { status: 400 });
  const file = await readUpload(form.get("file"), "pdf");
  if (!file.ok) return Response.json({ error: file.error }, { status: 400 });
  try {
    const r = await receiveDocument(prismaAutomationStore, automationDeps(), { batchId, fileName: file.name, bytes: file.bytes, actor: "automation", notify: true });
    return Response.json(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    return Response.json({ error: msg }, { status: msg === "batch not found" ? 404 : 500 });
  }
}
