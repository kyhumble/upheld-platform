import { prisma } from "./db";

export async function writeAudit(params: {
  agencyId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}) {
  await prisma.auditEvent.create({
    data: {
      agencyId: params.agencyId ?? null,
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metaJson: JSON.stringify(params.meta ?? {}),
    },
  });
}
