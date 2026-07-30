import { NextResponse } from "next/server";
import { getValidSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Agency-scoped CSV of findings (auth required). */
export async function GET(req: Request) {
  const session = await getValidSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const money = url.searchParams.get("money");
  const status = url.searchParams.get("status") ?? "OPEN";
  const severity = url.searchParams.get("severity");
  const module = url.searchParams.get("module");

  const findings = await prisma.chartFinding.findMany({
    where: {
      ...(status !== "all"
        ? { status: status as "OPEN" | "RESOLVED" | "DISMISSED" }
        : {}),
      ...(money === "RECOVERY" || money === "EXPOSURE" ? { impactType: money } : {}),
      ...(severity === "CRITICAL" ||
      severity === "HIGH" ||
      severity === "MEDIUM" ||
      severity === "LOW"
        ? { severity }
        : {}),
      ...(module === "CLINICAL" || module === "COMPLIANCE" || module === "REVENUE"
        ? { module }
        : {}),
      scan: { agencyId: session.agencyId, status: "COMPLETE" },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 500,
    include: {
      scan: {
        select: {
          publicToken: true,
          patientLabel: true,
          clinicianHint: true,
          readinessScore: true,
        },
      },
    },
  });

  const header = [
    "severity",
    "module",
    "impactType",
    "category",
    "title",
    "estimatedImpact",
    "status",
    "patient",
    "clinician",
    "readiness",
    "reportUrl",
    "cmsReference",
  ];

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://upheld-platform.vercel.app";
  const rows = findings.map((f) =>
    [
      f.severity,
      f.module,
      f.impactType,
      f.category,
      f.title,
      f.estimatedImpact ?? "",
      f.status,
      f.scan.patientLabel ?? "",
      f.scan.clinicianHint ?? "",
      f.scan.readinessScore ?? "",
      `${base.replace(/\/$/, "")}/scan/${f.scan.publicToken}`,
      f.cmsReference ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );

  const body = [header.join(","), ...rows].join("\n") + "\n";
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="upheld-issues-${session.agencyId.slice(0, 8)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
