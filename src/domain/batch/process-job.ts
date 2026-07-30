/**
 * Chunked batch processing — safe under serverless time limits.
 * Process N PENDING items per call, then re-aggregate job metrics.
 */

import { prisma } from "@/lib/db";
import { decryptFieldSafe, encryptField } from "@/lib/crypto";
import { analyzeClaimForBatch } from "./run-batch";
import { aggregateBatchItems, type KnownOutcome } from "./retrospective";
import type { RunnableClaim } from "./run-batch";

export const BATCH_CHUNK_SIZE = Number(process.env.BATCH_CHUNK_SIZE ?? 8);

function chunkSize(): number {
  const n = BATCH_CHUNK_SIZE;
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 25) : 8;
}

export type ProcessChunkResult = {
  jobId: string;
  status: string;
  processedThisChunk: number;
  pendingRemaining: number;
  processedCount: number;
  itemCount: number;
  complete: boolean;
};

/**
 * Process up to `limit` PENDING items for a job. Idempotent-safe per item.
 */
export async function processBatchChunk(
  jobId: string,
  opts?: { limit?: number },
): Promise<ProcessChunkResult> {
  const limit = opts?.limit ?? chunkSize();
  const job = await prisma.batchJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Batch job not found");
  if (job.status === "COMPLETE" || job.status === "FAILED") {
    return {
      jobId,
      status: job.status,
      processedThisChunk: 0,
      pendingRemaining: 0,
      processedCount: job.processedCount,
      itemCount: job.itemCount,
      complete: job.status === "COMPLETE",
    };
  }

  const pending = await prisma.batchItem.findMany({
    where: { jobId, status: "PENDING" },
    orderBy: { sortOrder: "asc" },
    take: limit,
  });

  if (pending.length === 0) {
    await finalizeJobAggregates(jobId);
    const updated = await prisma.batchJob.findUniqueOrThrow({ where: { id: jobId } });
    return {
      jobId,
      status: updated.status,
      processedThisChunk: 0,
      pendingRemaining: 0,
      processedCount: updated.processedCount,
      itemCount: updated.itemCount,
      complete: updated.status === "COMPLETE",
    };
  }

  // Agency wage index for chart-specific period $ on every claim in this job
  const agency = await prisma.agency.findUnique({
    where: { id: job.agencyId },
    select: { wageIndex: true },
  });
  const wageIndex = agency?.wageIndex ?? null;

  await prisma.batchJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING" },
  });

  for (const item of pending) {
    const text = decryptFieldSafe(item.chartText);
    const row: RunnableClaim = {
      claimId: item.claimId,
      knownOutcome: item.knownOutcome as KnownOutcome,
      knownLossUsd: item.knownLossUsd,
      knownReason: item.knownReason,
      chartText: text.startsWith("[encrypted") ? "" : text,
      fileName: item.fileName,
    };

    // If decrypt failed and text looks empty, try raw (legacy plaintext rows)
    if (row.chartText.length < 40 && item.chartText && !item.chartText.startsWith("enc:v1:")) {
      row.chartText = item.chartText;
    }

    const r = await analyzeClaimForBatch(row, { wageIndex });
    await prisma.batchItem.update({
      where: { id: item.id },
      data: {
        status: r.status,
        patientLabel: r.patientLabel,
        readinessScore: r.readinessScore,
        revenueAtRisk: r.revenueAtRisk,
        revenueUpside: r.revenueUpside,
        criticalCount: r.criticalCount,
        highCount: r.highCount,
        findingTitlesJson: JSON.stringify(r.findingTitles),
        categoryHitsJson: JSON.stringify(r.categories),
        wouldHaveCaught: r.wouldHaveCaught,
        matchReason: r.matchReason,
        errorMessage: r.errorMessage,
        // keep original chart text; only overwrite if we re-encrypted
        chartText: r.chartTextStored || item.chartText,
        summaryJson: r.summaryJson,
      },
    });
  }

  const remaining = await prisma.batchItem.count({
    where: { jobId, status: "PENDING" },
  });

  await finalizeJobAggregates(jobId, { forceComplete: remaining === 0 });

  const updated = await prisma.batchJob.findUniqueOrThrow({ where: { id: jobId } });
  return {
    jobId,
    status: updated.status,
    processedThisChunk: pending.length,
    pendingRemaining: remaining,
    processedCount: updated.processedCount,
    itemCount: updated.itemCount,
    complete: updated.status === "COMPLETE",
  };
}

export async function finalizeJobAggregates(
  jobId: string,
  opts?: { forceComplete?: boolean },
): Promise<void> {
  const items = await prisma.batchItem.findMany({
    where: { jobId },
    select: {
      status: true,
      knownOutcome: true,
      knownLossUsd: true,
      wouldHaveCaught: true,
      revenueAtRisk: true,
      revenueUpside: true,
      matchReason: true,
    },
  });

  const aggregate = aggregateBatchItems(items);
  let falsePressure = 0;
  for (const i of items) {
    if (
      i.knownOutcome === "PAID_CLEAN" &&
      i.matchReason?.toLowerCase().includes("false pressure")
    ) {
      falsePressure += 1;
    }
  }
  aggregate.falsePressureCount = falsePressure;

  const pendingLeft = items.filter((i) => i.status === "PENDING").length;
  const done = opts?.forceComplete || pendingLeft === 0;

  const job = await prisma.batchJob.findUnique({ where: { id: jobId } });
  const startedHint = job?.createdAt?.getTime() ?? Date.now();

  await prisma.batchJob.update({
    where: { id: jobId },
    data: {
      status: done ? "COMPLETE" : "PROCESSING",
      processedCount: aggregate.processedCount,
      failedCount: aggregate.failedCount,
      adverseCount: aggregate.adverseCount,
      caughtCount: aggregate.caughtCount,
      missedCount: aggregate.missedCount,
      falsePressureCount: aggregate.falsePressureCount,
      totalProtectUsd: aggregate.totalProtectUsd,
      totalCaptureUsd: aggregate.totalCaptureUsd,
      knownLossUsd: aggregate.knownLossUsd,
      recoverableUsd: aggregate.recoverableUsd,
      summaryJson: JSON.stringify({
        catchRate: aggregate.catchRate,
        summary: aggregate.summary,
      }),
      ...(done
        ? {
            completedAt: new Date(),
            durationMs: Date.now() - startedHint,
          }
        : {}),
    },
  });
}

/** Create job + items (PENDING), chart text encrypted at rest. Does not fully analyze. */
export async function createBatchJob(opts: {
  agencyId: string;
  userId: string;
  name: string;
  source: string;
  rows: RunnableClaim[];
}): Promise<string> {
  const job = await prisma.batchJob.create({
    data: {
      agencyId: opts.agencyId,
      createdById: opts.userId,
      name: opts.name.slice(0, 200),
      status: "PROCESSING",
      source: opts.source,
      itemCount: opts.rows.length,
    },
  });

  await prisma.batchItem.createMany({
    data: opts.rows.map((r, i) => ({
      jobId: job.id,
      claimId: r.claimId,
      sortOrder: i,
      status: "PENDING",
      fileName: r.fileName,
      knownOutcome: r.knownOutcome,
      knownLossUsd: r.knownLossUsd,
      knownReason: r.knownReason,
      chartText: encryptField(r.chartText),
    })),
  });

  return job.id;
}
