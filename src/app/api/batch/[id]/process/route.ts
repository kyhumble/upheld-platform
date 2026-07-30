import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getValidSession } from "@/lib/auth";
import { processBatchChunk } from "@/domain/batch/process-job";
import { writeAudit } from "@/lib/audit";

/**
 * POST /api/batch/[id]/process
 * Process next chunk of PENDING claims (chunked for serverless limits).
 * Client polls until complete=true.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getValidSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const job = await prisma.batchJob.findFirst({
    where: { id, agencyId: session.agencyId },
  });
  if (!job) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  try {
    const result = await processBatchChunk(id);

    if (result.complete) {
      await writeAudit({
        agencyId: session.agencyId,
        userId: session.userId,
        action: "batch.complete",
        entityType: "BatchJob",
        entityId: id,
        meta: {
          itemCount: result.itemCount,
          processedCount: result.processedCount,
        },
      }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    await prisma.batchJob.update({
      where: { id },
      data: {
        status: "FAILED",
        errorMessage: e instanceof Error ? e.message : "process failed",
      },
    });
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "process failed" },
      { status: 500 },
    );
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getValidSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const job = await prisma.batchJob.findFirst({
    where: { id, agencyId: session.agencyId },
    select: {
      id: true,
      status: true,
      itemCount: true,
      processedCount: true,
      failedCount: true,
      adverseCount: true,
      caughtCount: true,
      missedCount: true,
      knownLossUsd: true,
      recoverableUsd: true,
      summaryJson: true,
    },
  });
  if (!job) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
  const pending = await prisma.batchItem.count({
    where: { jobId: id, status: "PENDING" },
  });
  return NextResponse.json({
    ok: true,
    ...job,
    pendingRemaining: pending,
    complete: job.status === "COMPLETE",
  });
}
