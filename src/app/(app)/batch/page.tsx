import Link from "next/link";
import { prisma } from "@/lib/db";
import { getValidSession } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge, Card, CardHeader, Stat } from "@/components/ui";
import { BatchUploadForm, SampleBatchButton } from "@/components/batch-forms";

export const metadata = {
  title: "Retrospective batch",
};

export default async function BatchListPage() {
  const session = await getValidSession();
  if (!session) return null;

  const jobs = await prisma.batchJob.findMany({
    where: { agencyId: session.agencyId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const totals = jobs.reduce(
    (a, j) => {
      a.claims += j.itemCount;
      a.adverse += j.adverseCount;
      a.caught += j.caughtCount;
      a.knownLoss += j.knownLossUsd;
      a.recoverable += j.recoverableUsd;
      return a;
    },
    { claims: 0, adverse: 0, caught: 0, knownLoss: 0, recoverable: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
          Platform proof
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">
          Retrospective claim analysis
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          This is the core validation path — not a single free scan. Load a cohort of{" "}
          <strong className="text-navy">already-processed claims</strong> (paid, denied, LUPA,
          takeback). Upheld re-runs Clinical Revenue Integrity and reports whether we{" "}
          <strong className="text-navy">would have caught</strong> the rejection or deduction{" "}
          <em>before</em> submission.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Claims analyzed" value={String(totals.claims)} href="/batch" />
        <Stat
          label="Adverse labeled"
          value={String(totals.adverse)}
          hint="Denials · LUPA · takebacks"
          tone="warn"
        />
        <Stat
          label="Would-have-caught"
          value={String(totals.caught)}
          tone="teal"
          hint={
            totals.adverse > 0
              ? `${Math.round((totals.caught / totals.adverse) * 100)}% of adverse`
              : "Run a labeled batch"
          }
        />
        <Stat
          label="Known loss on caught"
          value={formatCurrency(totals.recoverable)}
          tone="danger"
          hint={`of ${formatCurrency(totals.knownLoss)} labeled loss`}
        />
      </div>

      <Card className="border-teal/30 bg-teal/5 p-6">
        <h2 className="text-base font-semibold text-navy">Start here</h2>
        <p className="mt-1 text-sm text-muted">
          Run the synthetic 5-claim sample to see catch / miss / paid-clean behavior with CMS-anchored
          dollars — then upload your own cohort (up to ~200 claims per job, chunked for reliability).
          Period $ uses your agency wage index from{" "}
          <Link href="/settings" className="font-semibold text-teal hover:underline">
            Settings
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <SampleBatchButton />
          <a
            href="/api/batch/sample-csv"
            className="text-xs font-semibold text-teal hover:underline"
          >
            Download sample CSV (with chart text)
          </a>
          <a
            href="/samples/retrospective-template.csv"
            className="text-xs font-semibold text-muted hover:text-teal hover:underline"
            download
          >
            Empty template
          </a>
        </div>
      </Card>

      <BatchUploadForm />

      <Card>
        <CardHeader
          title="Manifest format"
          subtitle="outcomes.csv inside a ZIP, or a single CSV with embedded chartText"
        />
        <div className="space-y-2 px-5 py-4 text-sm text-muted">
          <p className="font-mono text-[12px] text-navy">
            claimId,outcome,knownLossUsd,knownReason,fileName
          </p>
          <p>
            <strong className="text-navy">outcome</strong> values:{" "}
            <code>PAID_CLEAN</code>, <code>DENIED</code>, <code>PARTIAL_DENIAL</code>,{" "}
            <code>LUPA</code>, <code>TAKEBACK</code>, <code>ADJUSTMENT</code>
          </p>
          <p>
            Prefer de-identified packets. Authenticated agency batches are not subject to guest Free
            Chart Scan rate caps — this path is for pilot/platform volume.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Recent batches" subtitle={`${jobs.length} job(s)`} />
        <div className="divide-y divide-border">
          {jobs.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">
              No batches yet — run the sample retrospective above.
            </p>
          ) : (
            jobs.map((j) => {
              let catchRate: number | null = null;
              try {
                const s = JSON.parse(j.summaryJson) as { catchRate?: number | null };
                catchRate = s.catchRate ?? null;
              } catch {
                /* */
              }
              if (catchRate == null && j.adverseCount > 0) {
                catchRate = Math.round((j.caughtCount / j.adverseCount) * 1000) / 10;
              }
              return (
                <Link
                  key={j.id}
                  href={`/batch/${j.id}`}
                  className="flex flex-col gap-1 px-5 py-3.5 transition hover:bg-mist sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-navy">{j.name}</p>
                      <Badge
                        tone={
                          j.status === "COMPLETE"
                            ? "ok"
                            : j.status === "FAILED"
                              ? "danger"
                              : "warn"
                        }
                      >
                        {j.status}
                      </Badge>
                      <Badge tone="neutral">{j.source}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {j.itemCount} claims · {j.caughtCount}/{j.adverseCount} caught
                      {catchRate != null ? ` · ${catchRate}%` : ""} ·{" "}
                      {formatCurrency(j.recoverableUsd)} on caught loss
                    </p>
                  </div>
                  <p className="text-xs tabular-nums text-muted">{formatDate(j.createdAt)}</p>
                </Link>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
