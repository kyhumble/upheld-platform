import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  CMS_NATIONAL_30_DAY_PERIOD_PAYMENT,
  CMS_PAYMENT_YEAR,
} from "@/domain/chart-scan/knowledge";

/**
 * JSON export of a completed Chart Scan report.
 * Public token grants read access (same as web report). Agency scans are not further restricted
 * for free-scan funnel simplicity; add auth gates for pilot PHI if needed.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const session = await getSession();

  const scan = await prisma.chartScan.findUnique({
    where: { publicToken: token },
    include: {
      findings: { orderBy: { sortOrder: "asc" } },
      documents: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          documentType: true,
          sizeBytes: true,
          createdAt: true,
          // Omit full extractedText from default export (PHI minimization)
        },
      },
    },
  });

  if (!scan) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (scan.expiresAt && scan.expiresAt < new Date() && scan.type === "FREE") {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  let summary: Record<string, unknown> = {};
  try {
    summary = JSON.parse(scan.summaryJson) as Record<string, unknown>;
  } catch {
    summary = {};
  }

  let categoryStats: unknown[] = [];
  try {
    categoryStats = JSON.parse(scan.categoryStatsJson) as unknown[];
  } catch {
    categoryStats = [];
  }

  return NextResponse.json({
    id: scan.id,
    publicToken: scan.publicToken,
    type: scan.type,
    status: scan.status,
    agencyNameHint: scan.agencyNameHint,
    patientLabel: scan.patientLabel,
    clinicianHint: scan.clinicianHint,
    periodHint: scan.periodStartHint,
    scores: {
      readiness: scan.readinessScore,
      clinical: scan.clinicalScore,
      compliance: scan.complianceScore,
      revenue: scan.revenueScore,
    },
    revenueAtRisk: scan.revenueAtRisk,
    revenueUpside: scan.revenueUpside,
    expectedPeriodPayment:
      (summary.expectedPeriodPayment as number | undefined) ??
      (summary.paymentEstimate as { expectedPeriodPayment?: number } | undefined)
        ?.expectedPeriodPayment ??
      CMS_NATIONAL_30_DAY_PERIOD_PAYMENT,
    paymentYear: CMS_PAYMENT_YEAR,
    paymentEstimate: summary.paymentEstimate ?? null,
    severityCounts: {
      critical: scan.criticalCount,
      high: scan.highCount,
      medium: scan.mediumCount,
      low: scan.lowCount,
    },
    summary,
    categoryStats,
    findings: scan.findings.map((f) => ({
      id: f.id,
      module: f.module,
      category: f.category,
      severity: f.severity,
      status: f.status,
      title: f.title,
      description: f.description,
      suggestedCorrection: f.suggestedCorrection,
      cmsReference: f.cmsReference,
      estimatedImpact: f.estimatedImpact,
      impactType: f.impactType,
      evidenceExcerpt: f.evidenceExcerpt,
    })),
    documents: scan.documents,
    completedAt: scan.completedAt,
    expiresAt: scan.expiresAt,
    requestedBy: session?.email ?? null,
    reportUrl: `/scan/${scan.publicToken}`,
  });
}
