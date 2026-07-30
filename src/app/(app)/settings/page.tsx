import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Card, CardHeader, Badge, Stat } from "@/components/ui";
import { AgencySettingsForm, PilotRequestForm } from "@/components/agency-forms";
import { ChangePasswordForm } from "@/components/change-password-form";
import { CmsRateCard } from "@/components/cms-rate-card";
import { formatDate } from "@/lib/utils";
import { isStripePilotEnabled } from "@/lib/stripe";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) return null;

  const agency = await prisma.agency.findUnique({
    where: { id: session.agencyId },
  });
  if (!agency) return null;

  const canEdit = session.role === "ADMIN" || session.role === "EXECUTIVE";

  const [scanCount, openIssues, pilotEvents, members] = await Promise.all([
    prisma.chartScan.count({ where: { agencyId: session.agencyId } }),
    prisma.chartFinding.count({
      where: { status: "OPEN", scan: { agencyId: session.agencyId, status: "COMPLETE" } },
    }),
    prisma.auditEvent.count({
      where: { agencyId: session.agencyId, action: "pilot.interest" },
    }),
    prisma.membership.findMany({
      where: { agencyId: session.agencyId, status: "ACTIVE" },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
          Agency
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Profile, BAA posture, and pilot conversion · signed in as {session.role}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Plan tier"
          value={agency.planTier}
          hint="Click for activity trail"
          href="/activity"
        />
        <Stat
          label="BAA status"
          value={agency.baaStatus}
          hint="Signed BAA before identifiable PHI"
          tone={agency.baaStatus === "signed" ? "teal" : "warn"}
          href="/trust"
        />
        <Stat
          label="Pilot interest"
          value={
            agency.pilotPaidAt
              ? "Paid"
              : agency.pilotInterestAt
                ? "Requested"
                : "Not yet"
          }
          hint={
            agency.pilotPaidAt
              ? `Paid ${formatDate(agency.pilotPaidAt)}`
              : agency.pilotInterestAt
                ? formatDate(agency.pilotInterestAt)
                : `${pilotEvents} event(s) logged`
          }
          tone={agency.pilotPaidAt ? "teal" : undefined}
          href="/activity"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Scans" value={String(scanCount)} href="/scans" />
        <Stat
          label="Open issues"
          value={String(openIssues)}
          tone="warn"
          href="/issues"
        />
        <Stat label="Exports" value="CSV" hint="Scans & issues" href="/scans" />
      </div>

      <Card>
        <CardHeader title="Quick links" subtitle="Everything is one click away" />
        <div className="flex flex-wrap gap-3 px-5 py-4 text-sm font-semibold">
          <Link href="/batch" className="text-teal hover:underline">
            Retrospective batch →
          </Link>
          <Link href="/scan" className="text-teal hover:underline">
            New Free Chart Scan →
          </Link>
          <Link href="/issues" className="text-teal hover:underline">
            Issues worklist →
          </Link>
          <Link href="/executive" className="text-teal hover:underline">
            Executive scorecard →
          </Link>
          <a href="/api/agency/scans.csv" className="text-teal hover:underline">
            Export scans CSV →
          </a>
          <a href="/api/agency/issues.csv" className="text-teal hover:underline">
            Export issues CSV →
          </a>
          <Link href="/trust" className="text-teal hover:underline">
            Trust & CMS rates →
          </Link>
          <Link href="/calculations" className="text-teal hover:underline">
            How $ is calculated →
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Team"
          subtitle={`${members.length} active member${members.length === 1 ? "" : "s"} · seed / admin invites via DB for now`}
        />
        <div className="divide-y divide-border">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-navy">{m.user.name}</p>
                <p className="text-xs text-muted">{m.user.email}</p>
              </div>
              <Badge tone={m.role === "ADMIN" ? "navy" : "neutral"}>{m.role}</Badge>
            </div>
          ))}
          {members.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted">No active members.</p>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Agency profile"
          subtitle={canEdit ? "Editable by Admin / Executive" : "View only for your role"}
        />
        <div className="px-5 py-4">
          <AgencySettingsForm
            agency={{
              name: agency.name,
              npi: agency.npi,
              censusHint: agency.censusHint,
              wageIndex: agency.wageIndex ?? 1,
              baaStatus: agency.baaStatus,
              billingEmail: agency.billingEmail,
              phone: agency.phone,
            }}
            canEdit={canEdit}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Your password"
          subtitle={`${session.email} · required if you still use a demo default`}
        />
        <div className="px-5 py-4">
          <ChangePasswordForm />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="30-day pilot"
          subtitle={
            isStripePilotEnabled()
              ? "Request interest or pay online"
              : "Request interest — paid checkout deferred; we follow up by email"
          }
        />
        <div className="px-5 py-4">
          <PilotRequestForm
            alreadyRequested={!!agency.pilotInterestAt}
            defaultNote={agency.pilotInterestNote ?? ""}
            defaultEmail={session.email}
            defaultName={session.name}
            defaultAgency={agency.name}
            stripeEnabled={isStripePilotEnabled()}
          />
        </div>
      </Card>

      <CmsRateCard />
    </div>
  );
}
