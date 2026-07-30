import { NextResponse } from "next/server";
import { getValidSession } from "@/lib/auth";
import { buildSampleRetrospectiveManifest } from "@/domain/batch/parse-manifest";

/**
 * GET /api/batch/sample-csv
 * Downloadable sample retrospective manifest (with chartText) for offline review
 * or as a template to adapt for agency cohorts.
 */
export async function GET() {
  const session = await getValidSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const rows = buildSampleRetrospectiveManifest();
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };

  const header = "claimId,outcome,knownLossUsd,knownReason,chartText";
  const lines = rows.map((r) =>
    [
      escape(r.claimId),
      escape(r.knownOutcome),
      r.knownLossUsd != null ? String(r.knownLossUsd) : "",
      escape(r.knownReason ?? ""),
      escape(r.chartText),
    ].join(","),
  );

  const body = [header, ...lines].join("\n") + "\n";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="upheld-sample-retrospective.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
