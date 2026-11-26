import { z } from "zod";
import { actorFrom } from "@/server/guard";
import { draftAction, guard } from "@/server/access";
import { getSender, prismaDraftStore } from "@/server/drafts";
import { approveDraft, editDraft, sendDraft, skipDraft } from "@/email/workflow";
import { loadEnv } from "@/env";

export const runtime = "nodejs";

const EditBody = z.object({ body: z.string().min(1).max(20_000), subject: z.string().min(1).max(300).optional() });

/** approve | skip (open) · edit | send (passcode). Every action is written to the audit log. */
export async function POST(req: Request, { params }: { params: Promise<{ draftId: string; action: string }> }) {
  const { draftId, action } = await params;
  const denied = guard(req, draftAction(action));
  if (denied) return denied;
  const actor = actorFrom(req);
  try {
    switch (action) {
      case "approve":
        await approveDraft(prismaDraftStore, draftId, actor);
        return Response.json({ ok: true });
      case "skip":
        await skipDraft(prismaDraftStore, draftId, actor);
        return Response.json({ ok: true });
      case "edit": {
        const parsed = EditBody.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid edit" }, { status: 400 });
        const r = await editDraft(prismaDraftStore, draftId, parsed.data.body, actor, parsed.data.subject);
        return Response.json({ ok: true, warnings: r.warnings });
      }
      case "send":
        await sendDraft(prismaDraftStore, draftId, actor, getSender(), loadEnv().DEMO_EMAIL_OVERRIDE);
        return Response.json({ ok: true });
      default:
        return Response.json({ error: "Unknown action" }, { status: 404 });
    }
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}
