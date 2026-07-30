import Link from "next/link";
import { prisma } from "@/lib/db";
import { getValidSession } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Badge, Card, CardHeader } from "@/components/ui";

const ACTION_LABELS: Record<string, string> = {
  "scan.complete": "Chart scan completed",
  "scan.email_sent": "Report email sent",
  "scan.email_failed": "Report email failed",
  "finding.status": "Finding status updated",
  "finding.bulk_status": "Bulk finding update",
  "pilot.interest": "Pilot interest recorded",
  "pilot.checkout_started": "Pilot checkout started",
  "pilot.paid": "Pilot payment received",
  "batch.started": "Retrospective batch started",
  "batch.complete": "Retrospective batch completed",
  "ops.purge_expired_free_scans": "Expired free scans purged",
  "agency.settings_update": "Agency settings updated",
  "auth.sign_in": "User signed in",
  "auth.register_agency": "Agency registered",
};

export default async function ActivityPage() {
  const session = await getValidSession();
  if (!session) return null;

  const events = await prisma.auditEvent.findMany({
    where: { agencyId: session.agencyId },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
          Audit
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Activity</h1>
        <p className="mt-1 text-sm text-muted">
          Recent actions for {session.agencyName} · compliance trail
        </p>
      </div>

      <Card>
        <CardHeader title="Event log" subtitle="Last 80 agency events" />
        <div className="divide-y divide-border">
          {events.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">No activity yet.</p>
          ) : (
            events.map((e) => {
              let meta: Record<string, unknown> = {};
              try {
                meta = JSON.parse(e.metaJson) as Record<string, unknown>;
              } catch {
                meta = {};
              }
              const label = ACTION_LABELS[e.action] ?? e.action;
              return (
                <div
                  key={e.id}
                  className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-navy">{label}</p>
                      <Badge tone="neutral">{e.action}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {e.user?.name || e.user?.email || "System"}
                      {e.entityType ? ` · ${e.entityType}` : ""}
                      {e.entityId ? (
                        <span className="font-mono text-[10px]"> · {e.entityId.slice(0, 12)}…</span>
                      ) : null}
                    </p>
                    {Object.keys(meta).length > 0 ? (
                      <p className="mt-1 truncate text-[11px] text-muted/80">
                        {Object.entries(meta)
                          .slice(0, 4)
                          .map(([k, v]) => `${k}=${String(v).slice(0, 40)}`)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-xs tabular-nums text-muted">
                    {formatDate(e.createdAt)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <p className="text-center text-xs text-muted">
        Need a full export?{" "}
        <Link href="/settings" className="font-medium text-teal hover:underline">
          Contact support via pilot path
        </Link>
      </p>
    </div>
  );
}
