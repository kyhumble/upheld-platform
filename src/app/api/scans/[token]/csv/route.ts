import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** CSV export of findings for a chart scan (public token). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const scan = await prisma.chartScan.findUnique({
    where: { publicToken: token },
    include: { findings: { orderBy: { sortOrder: "asc" } } },
  });

  if (!scan) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (scan.expiresAt && scan.expiresAt < new Date() && scan.type === "FREE") {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  const header = [
    "sort",
    "severity",
    "module",
    "impactType",
    "category",
    "title",
    "estimatedImpact",
    "status",
    "cmsReference",
    "suggestedCorrection",
    "description",
  ];

  const rows = scan.findings.map((f, i) =>
    [
      i + 1,
      f.severity,
      f.module,
      f.impactType,
      f.category,
      f.title,
      f.estimatedImpact ?? "",
      f.status,
      f.cmsReference ?? "",
      f.suggestedCorrection,
      f.description,
    ]
      .map(csvEscape)
      .join(","),
  );

  const meta = [
    `# Upheld Chart Scan ${scan.publicToken}`,
    `# patient,${csvEscape(scan.patientLabel)}`,
    `# clinician,${csvEscape(scan.clinicianHint)}`,
    `# readiness,${scan.readinessScore ?? ""}`,
    `# expectedPeriodPayment,2038.22`,
    `# revenueAtRisk,${scan.revenueAtRisk ?? ""}`,
    `# revenueUpside,${scan.revenueUpside ?? ""}`,
    `# completedAt,${scan.completedAt?.toISOString() ?? ""}`,
    "",
  ].join("\n");

  const body = meta + [header.join(","), ...rows].join("\n") + "\n";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="upheld-scan-${scan.publicToken}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
