import { NextResponse } from "next/server";
import { getValidSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Agency-scoped CSV of chart scans (auth required). */
export async function GET() {
  const session = await getValidSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const scans = await prisma.chartScan.findMany({
    where: { agencyId: session.agencyId },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { _count: { select: { findings: true } } },
  });

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://upheld-platform.vercel.app").replace(
    /\/$/,
    "",
  );

  const header = [
    "createdAt",
    "status",
    "type",
    "patient",
    "clinician",
    "readiness",
    "revenueUpside",
    "revenueAtRisk",
    "critical",
    "high",
    "findings",
    "reportUrl",
    "publicToken",
  ];

  const rows = scans.map((s) =>
    [
      s.createdAt.toISOString(),
      s.status,
      s.type,
      s.patientLabel ?? "",
      s.clinicianHint ?? "",
      s.readinessScore ?? "",
      s.revenueUpside ?? "",
      s.revenueAtRisk ?? "",
      s.criticalCount,
      s.highCount,
      s._count.findings,
      `${base}/scan/${s.publicToken}`,
      s.publicToken,
    ]
      .map(csvEscape)
      .join(","),
  );

  const body = [header.join(","), ...rows].join("\n") + "\n";
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="upheld-scans-${session.agencyId.slice(0, 8)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
