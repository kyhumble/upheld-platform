import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession, canSeeRevenue } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge, Card, CardHeader, Stat } from "@/components/ui";

export default async function ExecutiveDashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const agencyId = session.agencyId;
  const showDollars = canSeeRevenue(session.role);

  const [complete, batchJobs, batchAgg] = await Promise.all([
    prisma.chartScan.findMany({
      where: { agencyId, status: "COMPLETE" },
      orderBy: { completedAt: "desc" },
      include: {
        findings: {
          where: { status: "OPEN" },
          select: { module: true, severity: true, category: true, estimatedImpact: true },
        },
      },
    }),
    prisma.batchJob.findMany({
      where: { agencyId, status: "COMPLETE" },
      orderBy: { completedAt: "desc" },
      take: 5,
    }),
    prisma.batchJob.aggregate({
      where: { agencyId, status: "COMPLETE" },
      _sum: {
        itemCount: true,
        adverseCount: true,
        caughtCount: true,
        missedCount: true,
        falsePressureCount: true,
        recoverableUsd: true,
        knownLossUsd: true,
        totalProtectUsd: true,
        totalCaptureUsd: true,
      },
      _count: true,
    }),
  ]);

  const batchCatchRate =
    batchAgg._sum.adverseCount && batchAgg._sum.adverseCount > 0
      ? Math.round(((batchAgg._sum.caughtCount ?? 0) / batchAgg._sum.adverseCount) * 1000) / 10
      : null;

  const avgReadiness =
    complete.length > 0
      ? Math.round(
          complete.reduce((s, c) => s + (c.readinessScore ?? 0), 0) / complete.length,
        )
      : null;

  const totalAtRisk = complete.reduce((s, c) => s + (c.revenueAtRisk ?? 0), 0);
  const totalUpside = complete.reduce((s, c) => s + (c.revenueUpside ?? 0), 0);
  const avgDurationMs = (() => {
    const ms = complete.map((c) => c.durationMs).filter((n): n is number => n != null);
    if (ms.length === 0) return null;
    return Math.round(ms.reduce((a, b) => a + b, 0) / ms.length);
  })();
  const criticalOpen = complete.reduce(
    (s, c) => s + c.findings.filter((f) => f.severity === "CRITICAL").length,
    0,
  );
  const highOpen = complete.reduce(
    (s, c) => s + c.findings.filter((f) => f.severity === "HIGH").length,
    0,
  );

  // Module scorecards
  const moduleTotals = {
    CLINICAL: { count: 0, impact: 0 },
    COMPLIANCE: { count: 0, impact: 0 },
    REVENUE: { count: 0, impact: 0 },
  };
  const categoryMap = new Map<string, { count: number; impact: number }>();

  for (const scan of complete) {
    for (const f of scan.findings) {
      const m = moduleTotals[f.module];
      if (m) {
        m.count += 1;
        m.impact += f.estimatedImpact ?? 0;
      }
      const cur = categoryMap.get(f.category) ?? { count: 0, impact: 0 };
      cur.count += 1;
      cur.impact += f.estimatedImpact ?? 0;
      categoryMap.set(f.category, cur);
    }
  }

  const topCategories = [...categoryMap.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.impact - a.impact || b.count - a.count)
    .slice(0, 8);

  // Trend: last 8 scans readiness
  const trend = [...complete].reverse().slice(-8);

  // LUPA-tagged findings
  const lupaFindings = complete.reduce(
    (s, c) => s + c.findings.filter((f) => /lupa/i.test(f.category)).length,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
            Executive view
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-navy">Revenue integrity scorecard</h1>
          <p className="mt-1 text-sm text-muted">
            Aggregated Free Chart Scan outcomes · {session.agencyName}
            {!showDollars ? " · dollar views limited for your role" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/batch"
            className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-[#06968b]"
          >
            Retrospective batch
          </Link>
          <Link
            href="/scan"
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-mist"
          >
            New scan
          </Link>
        </div>
      </div>

      {/* Primary platform proof */}
      <Card className="border-teal/30 bg-teal/5">
        <CardHeader
          title="Retrospective proof (board)"
          subtitle="Would-have-caught on already-processed claims — pilot success metric"
          action={
            <Link href="/batch" className="text-xs font-semibold text-teal hover:underline">
              All batches →
            </Link>
          }
        />
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Catch rate"
            value={batchCatchRate != null ? `${batchCatchRate}%` : "—"}
            hint={
              batchAgg._sum.adverseCount
                ? `${batchAgg._sum.caughtCount ?? 0}/${batchAgg._sum.adverseCount} adverse`
                : "No complete batches"
            }
            tone="teal"
            href="/batch"
          />
          <Stat
            label="Claims analyzed"
            value={String(batchAgg._sum.itemCount ?? 0)}
            hint={`${batchAgg._count} complete job${batchAgg._count === 1 ? "" : "s"}`}
            href="/batch"
          />
          <Stat
            label={showDollars ? "Loss on caught claims" : "Caught claims"}
            value={
              showDollars
                ? formatCurrency(batchAgg._sum.recoverableUsd)
                : String(batchAgg._sum.caughtCount ?? 0)
            }
            hint={
              showDollars
                ? `of ${formatCurrency(batchAgg._sum.knownLossUsd)} labeled loss`
                : `${batchAgg._sum.missedCount ?? 0} missed`
            }
            tone="danger"
            href="/batch"
          />
          <Stat
            label="False pressure"
            value={String(batchAgg._sum.falsePressureCount ?? 0)}
            hint="PAID_CLEAN with CRITICAL flags"
            tone="warn"
            href="/batch"
          />
        </div>
        {batchJobs.length > 0 ? (
          <div className="divide-y divide-border border-t border-border">
            {batchJobs.map((j) => {
              const rate =
                j.adverseCount > 0
                  ? Math.round((j.caughtCount / j.adverseCount) * 1000) / 10
                  : null;
              return (
                <Link
                  key={j.id}
                  href={`/batch/${j.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-white/60"
                >
                  <div>
                    <p className="font-medium text-navy">{j.name}</p>
                    <p className="text-xs text-muted">
                      {formatDate(j.completedAt ?? j.createdAt)} · {j.itemCount} claims
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={rate != null && rate >= 70 ? "ok" : rate != null ? "warn" : "neutral"}>
                      {rate != null ? `${rate}% catch` : "n/a"}
                    </Badge>
                    {showDollars ? (
                      <span className="font-semibold tabular-nums text-navy">
                        {formatCurrency(j.recoverableUsd)}
                      </span>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="border-t border-border px-5 py-6 text-center text-sm text-muted">
            Run a{" "}
            <Link href="/batch" className="font-semibold text-teal hover:underline">
              sample retrospective
            </Link>{" "}
            to populate board catch rate.
          </p>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Avg readiness"
          value={avgReadiness != null ? String(avgReadiness) : "—"}
          hint={`${complete.length} complete scans`}
          tone="teal"
          href="/scans"
        />
        <Stat
          label="Open critical"
          value={String(criticalOpen)}
          hint={`${highOpen} high still open`}
          tone="danger"
          href="/issues?severity=CRITICAL"
        />
        <Stat
          label={showDollars ? "Protect ($ at risk)" : "Exposure (hidden)"}
          value={showDollars ? formatCurrency(totalAtRisk) : "—"}
          hint="Denial / LUPA exposure"
          tone="danger"
          href="/issues?money=EXPOSURE"
        />
        <Stat
          label={showDollars ? "Capture (upside)" : "Capture (hidden)"}
          value={showDollars ? formatCurrency(totalUpside) : "—"}
          hint="If documentation completed"
          tone="teal"
          href="/issues?money=RECOVERY"
        />
        <Stat
          label="LUPA-related findings"
          value={String(lupaFindings)}
          hint="Open LUPA category items"
          tone="warn"
          href="/issues?money=EXPOSURE"
        />
        <Stat
          label="Avg analysis time"
          value={
            avgDurationMs != null
              ? avgDurationMs < 1000
                ? `${avgDurationMs}ms`
                : `${(avgDurationMs / 1000).toFixed(1)}s`
              : "—"
          }
          hint="End-to-end pipeline"
          href="/scans"
        />
      </div>

      {/* Module scorecards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {(
          [
            ["CLINICAL", "Clinical Integrity", moduleTotals.CLINICAL],
            ["COMPLIANCE", "Compliance Intelligence", moduleTotals.COMPLIANCE],
            ["REVENUE", "Revenue Intelligence", moduleTotals.REVENUE],
          ] as const
        ).map(([key, title, data]) => (
          <Link
            key={key}
            href={`/issues?module=${key}`}
            className="group rounded-xl border border-border bg-white p-5 shadow-sm transition hover:border-teal/40 hover:shadow-md"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-navy group-hover:text-teal">
              {data.count}
            </p>
            <p className="mt-1 text-sm text-muted">open findings across scans</p>
            {showDollars ? (
              <p className="mt-3 text-sm font-semibold text-danger">
                {formatCurrency(data.impact)} estimated impact
              </p>
            ) : null}
            <p className="mt-2 text-[11px] font-semibold text-teal opacity-0 group-hover:opacity-100">
              View issues →
            </p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Readiness trend"
            subtitle="Most recent complete scans (oldest → newest)"
          />
          <div className="px-5 py-4">
            {trend.length === 0 ? (
              <p className="text-sm text-muted">No complete scans yet.</p>
            ) : (
              <div className="flex h-40 items-end gap-2">
                {trend.map((s) => {
                  const score = s.readinessScore ?? 0;
                  const h = Math.max(8, score);
                  const color =
                    score >= 85
                      ? "bg-ok"
                      : score >= 70
                        ? "bg-teal"
                        : score >= 50
                          ? "bg-warn"
                          : "bg-danger";
                  return (
                    <Link
                      key={s.id}
                      href={`/scan/${s.publicToken}`}
                      className="group flex flex-1 flex-col items-center gap-1"
                      title={`${score}/100 · ${formatDate(s.completedAt)}`}
                    >
                      <span className="text-[10px] font-semibold tabular-nums text-muted opacity-0 transition group-hover:opacity-100">
                        {score}
                      </span>
                      <div
                        className={`w-full rounded-t-md ${color} opacity-90 transition group-hover:opacity-100`}
                        style={{ height: `${h}%` }}
                      />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Top issue categories" subtitle="By estimated impact" />
          <div className="divide-y divide-border">
            {topCategories.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No open findings.</p>
            ) : (
              topCategories.map((c) => (
                <Link
                  key={c.category}
                  href="/issues"
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition hover:bg-mist/60"
                >
                  <div>
                    <p className="font-medium text-navy group-hover:text-teal">{c.category}</p>
                    <p className="text-xs text-muted">{c.count} open</p>
                  </div>
                  {showDollars ? (
                    <p className="font-semibold tabular-nums text-navy">
                      {formatCurrency(c.impact)}
                    </p>
                  ) : (
                    <Badge tone="neutral">{c.count}</Badge>
                  )}
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent scored episodes" subtitle="Click through to full report" />
        <div className="divide-y divide-border">
          {complete.slice(0, 10).map((s) => (
            <Link
              key={s.id}
              href={`/scan/${s.publicToken}`}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-mist/50"
            >
              <div>
                <p className="text-sm font-medium text-navy">
                  {s.patientLabel || "Episode packet"}
                </p>
                <p className="text-xs text-muted">{formatDate(s.completedAt ?? s.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Badge
                  tone={
                    (s.readinessScore ?? 0) >= 70
                      ? "ok"
                      : (s.readinessScore ?? 0) >= 50
                        ? "warn"
                        : "danger"
                  }
                >
                  {s.readinessScore ?? "—"}/100
                </Badge>
                <span className="text-muted">{s.findings.length} open</span>
                {showDollars ? (
                  <span className="font-semibold tabular-nums text-danger">
                    {formatCurrency(s.revenueAtRisk)}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
          {complete.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">
              Run Free Chart Scans to populate executive scorecards.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
