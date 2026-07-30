import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardHeader, Stat, Badge, Button } from "@/components/ui";
import { OnboardingChecklist } from "@/components/onboarding-checklist";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const agencyId = session.agencyId;

  const [
    scans,
    complete,
    totals,
    recent,
    agency,
    openFindings,
    resolvedFindings,
    dismissedFindings,
    pilotEvents,
    batchCount,
    latestBatch,
    batchAgg,
  ] = await Promise.all([
    prisma.chartScan.count({ where: { agencyId } }),
    prisma.chartScan.count({ where: { agencyId, status: "COMPLETE" } }),
    prisma.chartScan.aggregate({
      where: { agencyId, status: "COMPLETE" },
      _avg: { readinessScore: true },
      _sum: { revenueAtRisk: true, revenueUpside: true },
    }),
    prisma.chartScan.findMany({
      where: { agencyId },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { _count: { select: { findings: true } } },
    }),
    prisma.agency.findUnique({ where: { id: agencyId } }),
    prisma.chartFinding.count({
      where: { status: "OPEN", scan: { agencyId, status: "COMPLETE" } },
    }),
    prisma.chartFinding.count({
      where: { status: "RESOLVED", scan: { agencyId } },
    }),
    prisma.chartFinding.count({
      where: { status: "DISMISSED", scan: { agencyId } },
    }),
    prisma.auditEvent.count({
      where: { agencyId, action: "pilot.interest" },
    }),
    prisma.batchJob.count({ where: { agencyId } }),
    prisma.batchJob.findFirst({
      where: { agencyId, status: "COMPLETE" },
      orderBy: { completedAt: "desc" },
    }),
    prisma.batchJob.aggregate({
      where: { agencyId, status: "COMPLETE" },
      _sum: {
        itemCount: true,
        adverseCount: true,
        caughtCount: true,
        recoverableUsd: true,
        knownLossUsd: true,
      },
    }),
  ]);

  const addressed = resolvedFindings + dismissedFindings;
  const showOnboarding =
    batchCount === 0 ||
    scans === 0 ||
    complete === 0 ||
    addressed === 0 ||
    agency?.baaStatus === "none";

  const batchCatchRate =
    batchAgg._sum.adverseCount && batchAgg._sum.adverseCount > 0
      ? Math.round(((batchAgg._sum.caughtCount ?? 0) / batchAgg._sum.adverseCount) * 1000) / 10
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-navy">{session.agencyName}</h1>
            <Badge tone={agency?.planTier === "pilot" || agency?.pilotPaidAt ? "ok" : "neutral"}>
              {agency?.planTier ?? "free"}
            </Badge>
            {agency?.baaStatus !== "signed" ? (
              <Badge tone="warn">BAA: {agency?.baaStatus ?? "none"}</Badge>
            ) : (
              <Badge tone="ok">BAA signed</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">Clinical Revenue Integrity workspace</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/scan">
            <Button variant="secondary">New scan</Button>
          </Link>
          <Link href="/batch">
            <Button>Retrospective batch</Button>
          </Link>
        </div>
      </div>

      {showOnboarding ? (
        <OnboardingChecklist
          state={{
            hasScan: scans > 0,
            hasCompleteScan: complete > 0,
            hasBatch: batchCount > 0,
            hasResolvedFinding: addressed > 0,
            baaSigned: agency?.baaStatus === "signed",
            pilotInterest: !!agency?.pilotInterestAt || pilotEvents > 0,
            pilotPaid: !!agency?.pilotPaidAt,
          }}
        />
      ) : null}

      {/* Platform proof — retrospective is primary */}
      <Card className="border-teal/25 bg-gradient-to-br from-teal/5 to-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
              Platform proof
            </p>
            <h2 className="mt-1 text-base font-semibold text-navy">
              Retrospective would-have-caught
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Catch rate on labeled denials, LUPA, and takebacks — the metric pilot buyers care about.
            </p>
          </div>
          <Link
            href="/batch"
            className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#06968b]"
          >
            {batchCount > 0 ? "View batches" : "Run sample batch"}
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Catch rate"
            value={batchCatchRate != null ? `${batchCatchRate}%` : "—"}
            hint={
              batchAgg._sum.adverseCount
                ? `${batchAgg._sum.caughtCount ?? 0} of ${batchAgg._sum.adverseCount} adverse`
                : "Run a labeled batch"
            }
            tone="teal"
            href="/batch"
          />
          <Stat
            label="Claims analyzed"
            value={String(batchAgg._sum.itemCount ?? 0)}
            hint={`${batchCount} job${batchCount === 1 ? "" : "s"}`}
            href="/batch"
          />
          <Stat
            label="Known loss on caught"
            value={formatCurrency(batchAgg._sum.recoverableUsd)}
            hint={`of ${formatCurrency(batchAgg._sum.knownLossUsd)} labeled`}
            tone="danger"
            href="/batch"
          />
          <Stat
            label="Latest batch"
            value={
              latestBatch
                ? latestBatch.adverseCount > 0
                  ? `${Math.round((latestBatch.caughtCount / latestBatch.adverseCount) * 100)}%`
                  : latestBatch.name.slice(0, 18)
                : "—"
            }
            hint={
              latestBatch
                ? `${latestBatch.caughtCount}/${latestBatch.adverseCount} · ${formatDate(latestBatch.completedAt ?? latestBatch.createdAt)}`
                : "No complete jobs yet"
            }
            href={latestBatch ? `/batch/${latestBatch.id}` : "/batch"}
          />
        </div>
      </Card>

      {/* KPI row — scan portfolio */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Avg readiness"
          value={
            totals._avg.readinessScore != null
              ? String(Math.round(totals._avg.readinessScore))
              : "—"
          }
          hint={`${complete} complete scans`}
          tone="teal"
          href="/scans"
        />
        <Stat
          label="Protect $"
          value={formatCurrency(totals._sum.revenueAtRisk)}
          hint="At risk if submitted"
          tone="danger"
          href="/issues?money=EXPOSURE"
        />
        <Stat
          label="Capture $"
          value={formatCurrency(totals._sum.revenueUpside)}
          hint="If documentation fixed"
          tone="teal"
          href="/issues?money=RECOVERY"
        />
        <Stat
          label="Open findings"
          value={String(openFindings)}
          hint={`${addressed} addressed`}
          tone="warn"
          href="/issues"
        />
      </div>

      {/* Recent scans */}
      <Card>
        <CardHeader
          title="Recent scans"
          subtitle="Open a report to review findings and readiness path"
          action={
            <Link href="/scans" className="text-xs font-semibold text-teal hover:underline">
              View all
            </Link>
          }
        />
        <div className="divide-y divide-border">
          {recent.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted">
              No scans yet.{" "}
              <Link href="/scan" className="font-semibold text-teal">
                Run a chart scan
              </Link>{" "}
              or{" "}
              <Link href="/batch" className="font-semibold text-teal">
                start a retrospective batch
              </Link>
              .
            </div>
          ) : (
            recent.map((s) => (
              <Link
                key={s.id}
                href={`/scan/${s.publicToken}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-mist/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy">
                    {s.patientLabel || s.agencyNameHint || "Episode scan"}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(s.createdAt)} · {s._count.findings} findings
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    tone={
                      s.status === "COMPLETE" ? "ok" : s.status === "FAILED" ? "danger" : "warn"
                    }
                  >
                    {s.status}
                  </Badge>
                  {s.readinessScore != null ? (
                    <span className="text-sm font-semibold tabular-nums text-navy">
                      {s.readinessScore}
                      <span className="text-xs font-normal text-muted">/100</span>
                    </span>
                  ) : null}
                  {s.revenueAtRisk != null ? (
                    <span className="text-sm font-semibold tabular-nums text-danger">
                      {formatCurrency(s.revenueAtRisk)}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
