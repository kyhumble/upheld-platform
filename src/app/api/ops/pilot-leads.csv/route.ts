import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Founder/ops export of pilot leads.
 * Auth: Authorization: Bearer $CRON_SECRET (or OPS_SECRET)
 */
export async function GET(req: Request) {
  const secret = process.env.OPS_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "OPS/CRON secret not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const q = new URL(req.url).searchParams.get("secret") ?? "";
  if (bearer !== secret && q !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const leads = await prisma.pilotLead.findMany({
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  const header = [
    "id",
    "createdAt",
    "email",
    "name",
    "agencyName",
    "status",
    "source",
    "scanToken",
    "readinessScore",
    "revenueAtRisk",
    "revenueUpside",
    "paidAt",
    "stripeSessionId",
    "note",
  ];

  const rows = leads.map((l) =>
    [
      l.id,
      l.createdAt.toISOString(),
      l.email,
      l.name ?? "",
      l.agencyName ?? "",
      l.status,
      l.source,
      l.scanToken ?? "",
      l.readinessScore ?? "",
      l.revenueAtRisk ?? "",
      l.revenueUpside ?? "",
      l.paidAt?.toISOString() ?? "",
      l.stripeSessionId ?? "",
      (l.note ?? "").replace(/"/g, '""'),
    ]
      .map((c) => `"${String(c)}"`)
      .join(","),
  );

  const csv = [header.join(","), ...rows].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="upheld-pilot-leads.csv"`,
    },
  });
}
