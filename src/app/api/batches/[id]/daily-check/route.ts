import { runDaily } from "@/automation/engine";
import { addDays } from "@/domain/dates";
import { guard } from "@/server/access";
import { actorFrom } from "@/server/guard";
import { automationDeps, prismaAutomationStore } from "@/server/automation";

export const runtime = "nodejs";
export const maxDuration = 60;

/** "Run daily check now" (AC-19.1, passcode): the daily check for this batch, moving its demo date forward one day. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(req, "batch.daily_check");
  if (denied) return denied;
  const { id } = await params;
  const run = await runDaily(prismaAutomationStore, automationDeps(), {
    batchIds: [id],
    todayFor: (b) => addDays(b.today, 1),
    actor: actorFrom(req),
    runId: `manual/${id}/${crypto.randomUUID()}`,
  });
  const r = run.results[0];
  return Response.json({ today: r?.today ?? null, changes: r?.changes.length ?? 0, reminders: r?.reminders.length ?? 0, digestSent: run.sent });
}
