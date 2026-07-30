import Link from "next/link";
import { prisma } from "@/lib/db";
import { getValidSession } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { Card, CardHeader, Stat, Badge } from "@/components/ui";

type Row = {
  clinician: string;
  scans: number;
  openFindings: number;
  avgReadiness: number | null;
  protect: number;
  capture: number;
};

export default async function CliniciansPage() {
  const session = await getValidSession();
  if (!session) return null;

  const scans = await prisma.chartScan.findMany({
    where: { agencyId: session.agencyId, status: "COMPLETE" },
    include: {
      findings: {
        where: { status: "OPEN" },
        select: { impactType: true, estimatedImpact: true },
      },
    },
  });

  const map = new Map<string, Row>();

  for (const s of scans) {
    const key = (s.clinicianHint || "Unattributed").trim() || "Unattributed";
    const cur = map.get(key) ?? {
      clinician: key,
      scans: 0,
      openFindings: 0,
      avgReadiness: null,
      protect: 0,
      capture: 0,
      _readySum: 0,
      _readyN: 0,
    } as Row & { _readySum?: number; _readyN?: number };

    const row = cur as Row & { _readySum: number; _readyN: number };
    if (row._readySum == null) {
      row._readySum = 0;
      row._readyN = 0;
    }
    row.scans += 1;
    row.openFindings += s.findings.length;
    if (s.readinessScore != null) {
      row._readySum += s.readinessScore;
      row._readyN += 1;
      row.avgReadiness = Math.round(row._readySum / row._readyN);
    }
    row.protect += s.revenueAtRisk ?? 0;
    row.capture += s.revenueUpside ?? 0;
    map.set(key, row);
  }

  const rows = [...map.values()].sort(
    (a, b) => b.protect + b.capture - (a.protect + a.capture) || b.scans - a.scans,
  );

  const attributed = rows.filter((r) => r.clinician !== "Unattributed").length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
          Team signals
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Clinicians</h1>
        <p className="mt-1 text-sm text-muted">
          Aggregated from chart text (assessing clinician / RN signature) · advisory only
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Clinician labels"
          value={String(rows.length)}
          hint={`${attributed} attributed`}
          href="/clinicians"
        />
        <Stat
          label="Scans rolled up"
          value={String(scans.length)}
          hint="Complete agency scans"
          href="/scans"
        />
        <Stat
          label="Open findings"
          value={String(rows.reduce((s, r) => s + r.openFindings, 0))}
          hint="Across all clinicians"
          tone="warn"
          href="/issues"
        />
      </div>

      <Card>
        <CardHeader
          title="Scorecard strip"
          subtitle="Capture / protect totals are scan-level CMS-scaled estimates"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-mist/50 text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-semibold">Clinician</th>
                <th className="px-5 py-3 font-semibold">Scans</th>
                <th className="px-5 py-3 font-semibold">Avg readiness</th>
                <th className="px-5 py-3 font-semibold">Open findings</th>
                <th className="px-5 py-3 font-semibold">Capture $</th>
                <th className="px-5 py-3 font-semibold">Protect $</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted">
                    No complete scans yet.{" "}
                    <Link href="/scan" className="font-semibold text-teal">
                      Run a Free Chart Scan
                    </Link>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.clinician}
                    className="border-b border-border last:border-0 hover:bg-mist/40"
                  >
                    <td className="px-5 py-3 font-medium text-navy">
                      <Link href="/scans" className="hover:text-teal hover:underline">
                        {r.clinician}
                      </Link>
                      {r.clinician === "Unattributed" ? (
                        <Badge tone="neutral" className="ml-2">
                          no label in chart
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href="/scans"
                        className="tabular-nums font-medium text-navy hover:text-teal hover:underline"
                      >
                        {r.scans}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href="/scans"
                        className="tabular-nums font-semibold text-navy hover:text-teal hover:underline"
                      >
                        {r.avgReadiness ?? "—"}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href="/issues"
                        className="tabular-nums font-medium text-navy hover:text-teal hover:underline"
                      >
                        {r.openFindings}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href="/issues?money=RECOVERY"
                        className="tabular-nums font-semibold text-ok hover:underline"
                      >
                        {formatCurrency(r.capture)}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href="/issues?money=EXPOSURE"
                        className="tabular-nums font-semibold text-danger hover:underline"
                      >
                        {formatCurrency(r.protect)}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted">
        Clinician attribution is extracted from packet language (e.g. &quot;Assessing clinician&quot;).
        It is not identity proof and may be incomplete until EMR identity is linked.
      </p>
    </div>
  );
}
