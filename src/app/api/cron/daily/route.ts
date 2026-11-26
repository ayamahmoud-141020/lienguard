import { runDaily } from "@/automation/engine";
import { automationDeps, prismaAutomationStore, requireCronSecret } from "@/server/automation";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Vercel Cron, once a day (AC-19.1): every ready batch is re-checked with the real date, then one digest goes out. */
export async function GET(req: Request) {
  const denied = requireCronSecret(req);
  if (denied) return denied;
  const today = new Date().toISOString().slice(0, 10);
  const run = await runDaily(prismaAutomationStore, automationDeps(), { todayFor: () => today, actor: "automation", runId: `cron/${today}` });
  return Response.json({ today, batches: run.results.length, digestSent: run.sent, digest: run.digest.totals });
}
