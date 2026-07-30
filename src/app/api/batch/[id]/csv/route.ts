import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getValidSession } from "@/lib/auth";

function csvEscape(v: string | number | boolean | null | undefined): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Board-ready export of would-have-caught retrospective results.
 * GET /api/batch/[id]/csv
 */
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
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!job) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  let catchRate: number | null = null;
  let summary = "";
  try {
    const s = JSON.parse(job.summaryJson) as { catchRate?: number | null; summary?: string };
    catchRate = s.catchRate ?? null;
    summary = s.summary ?? "";
  } catch {
    /* */
  }
  if (catchRate == null && job.adverseCount > 0) {
    catchRate = Math.round((job.caughtCount / job.adverseCount) * 1000) / 10;
  }

  const meta = [
    `# Upheld retrospective batch export`,
    `# job,${csvEscape(job.name)}`,
    `# status,${job.status}`,
    `# claims,${job.itemCount}`,
    `# adverse,${job.adverseCount}`,
    `# caught,${job.caughtCount}`,
    `# missed,${job.missedCount}`,
    `# catchRatePct,${catchRate ?? ""}`,
    `# knownLossUsd,${job.knownLossUsd}`,
    `# lossOnCaughtUsd,${job.recoverableUsd}`,
    `# protectModeledUsd,${job.totalProtectUsd}`,
    `# captureModeledUsd,${job.totalCaptureUsd}`,
    `# falsePressure,${job.falsePressureCount}`,
    `# summary,${csvEscape(summary)}`,
    `# exportedAt,${new Date().toISOString()}`,
  ].join("\n");

  const header = [
    "claimId",
    "knownOutcome",
    "knownLossUsd",
    "knownReason",
    "wouldHaveCaught",
    "matchReason",
    "readinessScore",
    "protectUsd",
    "captureUsd",
    "criticalCount",
    "highCount",
    "topFindings",
    "status",
    "patientLabel",
  ].join(",");

  const rows = job.items.map((i) => {
    let titles: string[] = [];
    try {
      titles = JSON.parse(i.findingTitlesJson) as string[];
    } catch {
      titles = [];
    }
    return [
      csvEscape(i.claimId),
      csvEscape(i.knownOutcome),
      csvEscape(i.knownLossUsd),
      csvEscape(i.knownReason),
      csvEscape(
        i.wouldHaveCaught === true ? "YES" : i.wouldHaveCaught === false ? "NO" : "N/A",
      ),
      csvEscape(i.matchReason),
      csvEscape(i.readinessScore),
      csvEscape(i.revenueAtRisk),
      csvEscape(i.revenueUpside),
      csvEscape(i.criticalCount),
      csvEscape(i.highCount),
      csvEscape(titles.slice(0, 5).join(" | ")),
      csvEscape(i.status),
      csvEscape(i.patientLabel),
    ].join(",");
  });

  const body = `${meta}\n${header}\n${rows.join("\n")}\n`;
  const safeName = job.name.replace(/[^\w.-]+/g, "_").slice(0, 60);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="upheld-retro-${safeName}.csv"`,
    },
  });
}
