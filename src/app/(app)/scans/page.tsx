import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge, Button, Card, CardHeader, Stat } from "@/components/ui";

export default async function ScansHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const sp = await searchParams;
  const status =
    sp.status === "COMPLETE" ||
    sp.status === "FAILED" ||
    sp.status === "PROCESSING" ||
    sp.status === "PENDING"
      ? sp.status
      : undefined;
  const q = (sp.q ?? "").trim().toLowerCase();

  const allScans = await prisma.chartScan.findMany({
    where: {
      agencyId: session.agencyId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { findings: true } } },
  });

  const scans = q
    ? allScans.filter((s) => {
        const blob = `${s.patientLabel ?? ""} ${s.clinicianHint ?? ""} ${s.agencyNameHint ?? ""} ${s.publicToken}`.toLowerCase();
        return blob.includes(q);
      })
    : allScans;

  const complete = allScans.filter((s) => s.status === "COMPLETE");
  const totalProtect = complete.reduce((s, c) => s + (c.revenueAtRisk ?? 0), 0);
  const totalCapture = complete.reduce((s, c) => s + (c.revenueUpside ?? 0), 0);
  const avgReady =
    complete.length > 0
      ? Math.round(
          complete.reduce((s, c) => s + (c.readinessScore ?? 0), 0) / complete.length,
        )
      : null;

  const filterHref = (patch: { status?: string | null; q?: string | null }) => {
    const params = new URLSearchParams();
    const st = patch.status === null ? undefined : (patch.status ?? status);
    const query = patch.q === null ? undefined : (patch.q ?? sp.q);
    if (st) params.set("status", st);
    if (query) params.set("q", query);
    const s = params.toString();
    return s ? `/scans?${s}` : "/scans";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Chart Scans</h1>
          <p className="mt-1 text-sm text-muted">Free and pilot episode reviews for your agency</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/agency/scans.csv">
            <Button variant="secondary">Export CSV</Button>
          </a>
          <Link href="/scan">
            <Button>New Free Chart Scan</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total scans"
          value={String(allScans.length)}
          hint="All statuses"
          href={filterHref({ status: null })}
        />
        <Stat
          label="Complete"
          value={String(complete.length)}
          hint="Ready reports"
          tone="teal"
          href={filterHref({ status: "COMPLETE" })}
        />
        <Stat
          label="Capture $"
          value={formatCurrency(totalCapture)}
          hint="Sum of upside"
          tone="teal"
          href="/issues?money=RECOVERY"
        />
        <Stat
          label="Protect $"
          value={formatCurrency(totalProtect)}
          hint="Sum of exposure"
          tone="danger"
          href="/issues?money=EXPOSURE"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            [undefined, "All"],
            ["COMPLETE", "Complete"],
            ["PROCESSING", "Processing"],
            ["FAILED", "Failed"],
          ] as const
        ).map(([st, label]) => {
          const active = (st ?? undefined) === status;
          return (
            <Link
              key={label}
              href={filterHref({ status: st ?? null })}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                active ? "bg-navy text-white" : "border border-border bg-white text-muted"
              }`}
            >
              {label}
            </Link>
          );
        })}
        <span className="ml-auto text-xs text-muted">
          Avg readiness:{" "}
          <Link href={filterHref({ status: "COMPLETE" })} className="font-semibold text-navy hover:text-teal">
            {avgReady ?? "—"}
          </Link>
        </span>
      </div>

      <form className="flex flex-wrap gap-2" action="/scans" method="get">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search patient, clinician, token…"
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <Card>
        <CardHeader
          title="Scan history"
          subtitle={`${scans.length} shown${q ? ` for “${sp.q}”` : ""}`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-mist/50 text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-semibold">When</th>
                <th className="px-5 py-3 font-semibold">Episode</th>
                <th className="px-5 py-3 font-semibold">Clinician</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Readiness</th>
                <th className="px-5 py-3 font-semibold">Capture</th>
                <th className="px-5 py-3 font-semibold">Protect</th>
                <th className="px-5 py-3 font-semibold">Findings</th>
              </tr>
            </thead>
            <tbody>
              {scans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-muted">
                    No scans match.{" "}
                    <Link href="/scan" className="font-semibold text-teal">
                      Run a Free Chart Scan
                    </Link>
                  </td>
                </tr>
              ) : (
                scans.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-mist/40">
                    <td className="px-5 py-3 text-muted">{formatDate(s.createdAt)}</td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/scan/${s.publicToken}`}
                        className="font-medium text-navy hover:text-teal hover:underline"
                      >
                        {s.patientLabel || "Episode packet"}
                      </Link>
                      <p className="text-xs text-muted">{s.type}</p>
                    </td>
                    <td className="px-5 py-3">
                      {s.clinicianHint ? (
                        <Link
                          href="/clinicians"
                          className="text-navy hover:text-teal hover:underline"
                        >
                          {s.clinicianHint}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Link href={filterHref({ status: s.status })}>
                        <Badge
                          tone={
                            s.status === "COMPLETE"
                              ? "ok"
                              : s.status === "FAILED"
                                ? "danger"
                                : "warn"
                          }
                        >
                          {s.status}
                        </Badge>
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/scan/${s.publicToken}`}
                        className="tabular-nums font-medium text-navy hover:text-teal hover:underline"
                      >
                        {s.readinessScore ?? "—"}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/scan/${s.publicToken}#findings&money=RECOVERY&status=all`}
                        className="tabular-nums font-medium text-ok hover:underline"
                      >
                        {formatCurrency(s.revenueUpside)}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/scan/${s.publicToken}#findings&money=EXPOSURE&status=all`}
                        className="tabular-nums font-medium text-danger hover:underline"
                      >
                        {formatCurrency(s.revenueAtRisk)}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/scan/${s.publicToken}#findings&status=all`}
                        className="tabular-nums text-muted hover:text-teal hover:underline"
                      >
                        {s._count.findings}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
