import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";

export async function audit(actor: string, action: string, entityType: string, entityId: string, details?: Prisma.InputJsonValue): Promise<void> {
  await prisma.auditLog.create({ data: { actor, action, entityType, entityId, detailsJson: details } });
}
