import Link from "next/link";
import { prisma } from "@/lib/db";
import { getValidSession } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge, Card, CardHeader, Button, Stat } from "@/components/ui";
import { SeverityBadge, ModuleBadge } from "@/components/severity-badge";
import { updateFindingStatusAction } from "@/server/actions/scans";

export default async function IssuesWorklistPage({
  searchParams,
}: {
  searchParams: Promise<{ money?: string; status?: string; severity?: string; module?: string }>;
}) {
  const session = await getValidSession();
  if (!session) return null;
  const sp = await searchParams;
  const money = sp.money === "RECOVERY" || sp.money === "EXPOSURE" ? sp.money : undefined;
  const status =
    sp.status === "RESOLVED" || sp.status === "DISMISSED" || sp.status === "all"
      ? sp.status
      : "OPEN";
  const severity =
    sp.severity === "CRITICAL" ||
    sp.severity === "HIGH" ||
    sp.severity === "MEDIUM" ||
    sp.severity === "LOW"
      ? sp.severity
      : undefined;
  const moduleFilter =
    sp.module === "CLINICAL" || sp.module === "COMPLIANCE" || sp.module === "REVENUE"
      ? sp.module
      : undefined;

  const findings = await prisma.chartFinding.findMany({
    where: {
      ...(status !== "all" ? { status: status as "OPEN" | "RESOLVED" | "DISMISSED" } : {}),
      ...(money ? { impactType: money } : {}),
      ...(severity ? { severity } : {}),
      ...(moduleFilter ? { module: moduleFilter } : {}),
      scan: { agencyId: session.agencyId, status: "COMPLETE" },
    },
    orderBy: [{ severity: "asc" }, { estimatedImpact: "desc" }],
    take: 100,
    include: {
      scan: {
        select: {
          publicToken: true,
          patientLabel: true,
          completedAt: true,
          readinessScore: true,
        },
      },
    },
  });

  // Severity enum order CRITICAL < HIGH... may not sort correctly as string - re-sort
  const rank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  findings.sort(
    (a, b) =>
      (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) ||
      (b.estimatedImpact ?? 0) - (a.estimatedImpact ?? 0),
  );

  const openCapture = findings
    .filter((f) => f.status === "OPEN" && f.impactType === "RECOVERY")
    .reduce((s, f) => s + (f.estimatedImpact ?? 0), 0);
  const openProtect = findings
    .filter((f) => f.status === "OPEN" && f.impactType === "EXPOSURE")
    .reduce((s, f) => s + (f.estimatedImpact ?? 0), 0);

  const filterHref = (patch: {
    money?: string | null;
    status?: string | null;
    severity?: string | null;
    module?: string | null;
  }) => {
    const q = new URLSearchParams();
    const m = patch.money === null ? undefined : (patch.money ?? money);
    const st = patch.status === null ? "OPEN" : (patch.status ?? status);
    const sev = patch.severity === null ? undefined : (patch.severity ?? severity);
    const mod = patch.module === null ? undefined : (patch.module ?? moduleFilter);
    if (m) q.set("money", m);
    if (st && st !== "OPEN") q.set("status", st);
    if (sev) q.set("severity", sev);
    if (mod) q.set("module", mod);
    const s = q.toString();
    return s ? `/issues?${s}` : "/issues";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
            Agency worklist
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-navy">Issues</h1>
          <p className="mt-1 text-sm text-muted">
            Open findings across Free Chart Scans · capture and protect
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/agency/issues.csv?${new URLSearchParams({
              ...(money ? { money } : {}),
              ...(status ? { status } : {}),
              ...(severity ? { severity } : {}),
              ...(moduleFilter ? { module: moduleFilter } : {}),
            }).toString()}`}
          >
            <Button variant="secondary">Export CSV</Button>
          </a>
          <Link href="/scan">
            <Button>New Free Chart Scan</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="In view"
          value={String(findings.length)}
          hint={`Status: ${status}`}
          href={filterHref({})}
        />
        <Stat
          label="Open capture"
          value={formatCurrency(openCapture)}
          hint="Could add if fixed"
          tone="teal"
          href={filterHref({ money: "RECOVERY", status: "OPEN" })}
        />
        <Stat
          label="Open protect"
          value={formatCurrency(openProtect)}
          hint="At risk if submitted"
          tone="danger"
          href={filterHref({ money: "EXPOSURE", status: "OPEN" })}
        />
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          href={filterHref({ status: "OPEN" })}
          className={`rounded-full px-3 py-1 font-semibold ${status === "OPEN" ? "bg-navy text-white" : "border border-border bg-white text-muted"}`}
        >
          Open
        </Link>
        <Link
          href={filterHref({ status: "all" })}
          className={`rounded-full px-3 py-1 font-semibold ${status === "all" ? "bg-navy text-white" : "border border-border bg-white text-muted"}`}
        >
          All statuses
        </Link>
        <Link
          href={filterHref({ money: undefined })}
          className={`rounded-full px-3 py-1 font-semibold ${!money ? "bg-navy text-white" : "border border-border bg-white text-muted"}`}
        >
          All $ types
        </Link>
        <Link
          href={filterHref({ money: "RECOVERY" })}
          className={`rounded-full px-3 py-1 font-semibold ${money === "RECOVERY" ? "bg-ok text-white" : "border border-border bg-white text-muted"}`}
        >
          Capture only
        </Link>
        <Link
          href={filterHref({ money: "EXPOSURE" })}
          className={`rounded-full px-3 py-1 font-semibold ${money === "EXPOSURE" ? "bg-danger text-white" : "border border-border bg-white text-muted"}`}
        >
          Protect only
        </Link>
        <span className="mx-1 text-border">|</span>
        {(
          [
            ["CRITICAL", "Critical"],
            ["HIGH", "High"],
            ["MEDIUM", "Medium"],
            ["LOW", "Low"],
          ] as const
        ).map(([sev, label]) => (
          <Link
            key={sev}
            href={filterHref({ severity: severity === sev ? null : sev })}
            className={`rounded-full px-3 py-1 font-semibold ${severity === sev ? "bg-navy text-white" : "border border-border bg-white text-muted"}`}
          >
            {label}
          </Link>
        ))}
        <span className="mx-1 text-border">|</span>
        {(
          [
            ["CLINICAL", "Clinical"],
            ["COMPLIANCE", "Compliance"],
            ["REVENUE", "Revenue"],
          ] as const
        ).map(([mod, label]) => (
          <Link
            key={mod}
            href={filterHref({ module: moduleFilter === mod ? null : mod })}
            className={`rounded-full px-3 py-1 font-semibold ${moduleFilter === mod ? "bg-teal text-white" : "border border-border bg-white text-muted"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title="Findings" subtitle="Click episode for full report" />
        <div className="divide-y divide-border">
          {findings.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">No findings match.</p>
          ) : (
            findings.map((f) => (
              <div
                key={f.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={f.severity} />
                    <ModuleBadge module={f.module} />
                    <Badge
                      tone={
                        f.impactType === "RECOVERY"
                          ? "ok"
                          : f.impactType === "EXPOSURE"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {f.impactType === "RECOVERY" ? "CAPTURE" : f.impactType === "EXPOSURE" ? "PROTECT" : "INFO"}
                    </Badge>
                    <Badge tone="neutral">{f.category}</Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-navy">{f.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{f.description}</p>
                  <p className="mt-2 text-xs text-muted">
                    <Link
                      href={`/scan/${f.scan.publicToken}`}
                      className="font-medium text-teal hover:underline"
                    >
                      {f.scan.patientLabel || "Episode report"}
                    </Link>
                    {" · "}
                    {formatDate(f.scan.completedAt)}
                    {f.estimatedImpact != null && f.estimatedImpact > 0 ? (
                      <span
                        className={`ml-2 font-semibold ${f.impactType === "RECOVERY" ? "text-ok" : "text-danger"}`}
                      >
                        {formatCurrency(f.estimatedImpact)}
                      </span>
                    ) : null}
                  </p>
                </div>
                {f.status === "OPEN" ? (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <form action={updateFindingStatusAction}>
                      <input type="hidden" name="findingId" value={f.id} />
                      <input type="hidden" name="status" value="RESOLVED" />
                      <Button type="submit" size="sm">
                        Resolve
                      </Button>
                    </form>
                    <form action={updateFindingStatusAction}>
                      <input type="hidden" name="findingId" value={f.id} />
                      <input type="hidden" name="status" value="DISMISSED" />
                      <Button type="submit" size="sm" variant="secondary">
                        Dismiss
                      </Button>
                    </form>
                  </div>
                ) : (
                  <Badge tone="ok">{f.status}</Badge>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
