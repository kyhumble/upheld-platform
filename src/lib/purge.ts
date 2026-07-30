import { prisma } from "./db";
import { writeAudit } from "./audit";

export type PurgeResult = {
  dryRun: boolean;
  expiredScans: number;
  deletedScans: number;
  deletedFindings: number;
  deletedDocuments: number;
  cutoff: string;
};

/**
 * Delete FREE scans past expiresAt (and cascaded findings/documents).
 * Does not delete PILOT/FULL agency history.
 */
export async function purgeExpiredFreeScans(opts?: {
  dryRun?: boolean;
  now?: Date;
}): Promise<PurgeResult> {
  const now = opts?.now ?? new Date();
  const dryRun = opts?.dryRun ?? false;

  const expired = await prisma.chartScan.findMany({
    where: {
      type: "FREE",
      expiresAt: { lte: now },
    },
    select: { id: true },
  });

  if (expired.length === 0) {
    return {
      dryRun,
      expiredScans: 0,
      deletedScans: 0,
      deletedFindings: 0,
      deletedDocuments: 0,
      cutoff: now.toISOString(),
    };
  }

  const ids = expired.map((s) => s.id);

  const [findingCount, docCount] = await Promise.all([
    prisma.chartFinding.count({ where: { scanId: { in: ids } } }),
    prisma.chartDocument.count({ where: { scanId: { in: ids } } }),
  ]);

  if (dryRun) {
    return {
      dryRun: true,
      expiredScans: ids.length,
      deletedScans: 0,
      deletedFindings: 0,
      deletedDocuments: 0,
      cutoff: now.toISOString(),
    };
  }

  // Cascade on ChartScan deletes findings/documents
  const del = await prisma.chartScan.deleteMany({
    where: { id: { in: ids }, type: "FREE" },
  });

  await writeAudit({
    action: "ops.purge_expired_free_scans",
    meta: {
      deletedScans: del.count,
      deletedFindings: findingCount,
      deletedDocuments: docCount,
      cutoff: now.toISOString(),
    },
  });

  return {
    dryRun: false,
    expiredScans: ids.length,
    deletedScans: del.count,
    deletedFindings: findingCount,
    deletedDocuments: docCount,
    cutoff: now.toISOString(),
  };
}
