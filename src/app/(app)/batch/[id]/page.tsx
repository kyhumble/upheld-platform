import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getValidSession } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge, Card, CardHeader, Stat } from "@/components/ui";
import { BatchProgress } from "@/components/batch-progress";
import { CopyBoardButton } from "@/components/copy-board-button";

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getValidSession();
  if (!session) return null;
  const { id } = await params;

  const job = await prisma.batchJob.findFirst({
    where: { id, agencyId: session.agencyId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!job) notFound();

  let summaryText = "";
  let catchRate: number | null = null;
  try {
    const s = JSON.parse(job.summaryJson) as { summary?: string; catchRate?: number | null };
    summaryText = s.summary ?? "";
    catchRate = s.catchRate ?? null;
  } catch {
    /* */
  }
  if (catchRate == null && job.adverseCount > 0) {
    catchRate = Math.round((job.caughtCount / job.adverseCount) * 1000) / 10;
  }

  const missed = job.items.filter(
    (i) =>
      i.status === "COMPLETE" &&
      i.wouldHaveCaught === false &&
      ["DENIED", "PARTIAL_DENIAL", "LUPA", "TAKEBACK", "ADJUSTMENT"].includes(i.knownOutcome),
  );
  const caught = job.items.filter((i) => i.wouldHaveCaught === true);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/batch" className="text-xs font-semibold text-teal hover:underline">
            ← All batches
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-navy">{job.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {formatDate(job.createdAt)}
            {job.durationMs != null
              ? ` · ${(job.durationMs / 1000).toFixed(1)}s wall time`
              : ""}{" "}
            · {job.source}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/batch/${job.id}/csv`}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-sm hover:bg-mist"
          >
            Export CSV (board)
          </a>
          <Badge
            tone={
              job.status === "COMPLETE" ? "ok" : job.status === "FAILED" ? "danger" : "warn"
            }
          >
            {job.status}
          </Badge>
        </div>
      </div>

      <BatchProgress
        jobId={job.id}
        initialStatus={job.status}
        itemCount={job.itemCount}
        processedCount={job.processedCount + job.failedCount}
      />

      {job.errorMessage ? (
        <div className="rounded-xl border border-danger/30 bg-red-50 px-4 py-3 text-sm text-danger">
          {job.errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Claims" value={String(job.itemCount)} hint={`${job.processedCount} ok`} />
        <Stat
          label="Catch rate"
          value={catchRate != null ? `${catchRate}%` : "—"}
          hint={`${job.caughtCount} of ${job.adverseCount} adverse`}
          tone="teal"
        />
        <Stat
          label="Known loss labeled"
          value={formatCurrency(job.knownLossUsd)}
          tone="danger"
        />
        <Stat
          label="Loss on caught claims"
          value={formatCurrency(job.recoverableUsd)}
          hint="Would have been flagged pre-submit"
          tone="teal"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Protect $ (modeled)" value={formatCurrency(job.totalProtectUsd)} />
        <Stat label="Capture $ (modeled)" value={formatCurrency(job.totalCaptureUsd)} tone="teal" />
        <Stat
          label="False pressure"
          value={String(job.falsePressureCount)}
          hint="Paid-clean with CRITICAL flags"
          tone="warn"
        />
      </div>

      {summaryText ? (
        <Card>
          <CardHeader
            title="Board read-out"
            subtitle="Paste into pilot / QA decks"
            action={<CopyBoardButton text={summaryText} />}
          />
          <div className="space-y-3 px-5 py-4">
            <p className="text-sm leading-relaxed text-ink/90">{summaryText}</p>
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              <li className="rounded-lg border border-border bg-paper px-3 py-2">
                <span className="text-xs text-muted">Catch rate</span>
                <p className="font-semibold tabular-nums text-navy">
                  {catchRate != null ? `${catchRate}%` : "—"}{" "}
                  <span className="text-xs font-normal text-muted">
                    ({job.caughtCount}/{job.adverseCount} adverse)
                  </span>
                </p>
              </li>
              <li className="rounded-lg border border-border bg-paper px-3 py-2">
                <span className="text-xs text-muted">Known loss on caught claims</span>
                <p className="font-semibold tabular-nums text-ok">
                  {formatCurrency(job.recoverableUsd)}
                </p>
              </li>
              <li className="rounded-lg border border-border bg-paper px-3 py-2">
                <span className="text-xs text-muted">Total labeled loss</span>
                <p className="font-semibold tabular-nums text-danger">
                  {formatCurrency(job.knownLossUsd)}
                </p>
              </li>
              <li className="rounded-lg border border-border bg-paper px-3 py-2">
                <span className="text-xs text-muted">Missed adverse</span>
                <p className="font-semibold tabular-nums text-navy">{missed.length}</p>
              </li>
            </ul>
            <a
              href={`/api/batch/${job.id}/csv`}
              className="inline-block text-sm font-semibold text-teal hover:underline"
            >
              Download full would-have-caught CSV →
            </a>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Would-have-caught"
          subtitle={`${caught.length} caught · ${missed.length} missed adverse`}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-paper text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">Claim</th>
                <th className="px-4 py-2 font-semibold">Known outcome</th>
                <th className="px-4 py-2 font-semibold">Known loss</th>
                <th className="px-4 py-2 font-semibold">Caught?</th>
                <th className="px-4 py-2 font-semibold">Readiness</th>
                <th className="px-4 py-2 font-semibold">Protect $</th>
                <th className="px-4 py-2 font-semibold">Match</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {job.items.map((i) => (
                <tr key={i.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{i.claimId}</p>
                    {i.patientLabel ? (
                      <p className="text-[11px] text-muted">{i.patientLabel}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        i.knownOutcome === "PAID_CLEAN"
                          ? "ok"
                          : i.knownOutcome === "UNKNOWN"
                            ? "neutral"
                            : "danger"
                      }
                    >
                      {i.knownOutcome}
                    </Badge>
                    {i.knownReason ? (
                      <p className="mt-1 max-w-[180px] text-[11px] text-muted">{i.knownReason}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {i.knownLossUsd != null ? formatCurrency(i.knownLossUsd) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {i.wouldHaveCaught === true ? (
                      <Badge tone="ok">Yes</Badge>
                    ) : i.wouldHaveCaught === false ? (
                      <Badge tone="warn">No</Badge>
                    ) : (
                      <Badge tone="neutral">n/a</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{i.readinessScore ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-danger">
                    {formatCurrency(i.revenueAtRisk)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    <p className="max-w-[240px]">{i.matchReason ?? i.errorMessage ?? "—"}</p>
                    {(() => {
                      try {
                        const titles = JSON.parse(i.findingTitlesJson) as string[];
                        if (!titles?.length) return null;
                        return (
                          <p className="mt-1 max-w-[240px] text-[10px] text-muted/80">
                            {titles.slice(0, 3).join(" · ")}
                          </p>
                        );
                      } catch {
                        return null;
                      }
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-center text-xs text-muted">
        Advisory only · Human review required · Not a CMS grouper ·{" "}
        <Link href="/batch" className="text-teal hover:underline">
          New batch
        </Link>
      </p>
    </div>
  );
}
