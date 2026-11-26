import { prisma } from "@/db/prisma";
import { healthReport } from "@/server/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const report = await healthReport(process.env, () => prisma.$queryRaw`SELECT 1`);
  return Response.json(report, { status: report.ok ? 200 : 503 });
}
