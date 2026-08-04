import type { ChartDocument, ChartFinding, ChartScan } from "@prisma/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { isStripePilotEnabled } from "@/lib/stripe";
import {
  CMS_NATIONAL_30_DAY_PERIOD_PAYMENT,
  CMS_PAYMENT_YEAR,
} from "@/domain/chart-scan/knowledge";
import type { PaymentEstimateSummary } from "@/domain/chart-scan/types";
import { Card, CardHeader, Badge } from "./ui";
import { ScoreRing } from "./severity-badge";
import { EmailReportForm } from "./email-report-form";
import { PilotCtaForm } from "./pilot-cta-form";
import { CmsRateCard } from "./cms-rate-card";
import { FindingsPanel } from "./findings-panel";
import { ResolutionProgress } from "./resolution-progress";
import { DocumentsPanel } from "./documents-panel";
import { ShareReportButton } from "./share-report-button";
import { PrintButton } from "./print-button";
import { ReadinessPath } from "./readiness-path";
import { PaymentBreakdown } from "./payment-breakdown";
import { SendToFieldForm } from "./send-to-field-form";
import {
  liveScoresFromFindings,
  READINESS_GATE,
} from "@/domain/chart-scan/readiness-path";

type ScanWithFindings = ChartScan & {
  findings: ChartFinding[];
  documents?: ChartDocument[];
  agency?: { name: string } | null;
};

type LupaSummary = {
  risk?: string;
  effectiveVisits?: number | null;
  assumedThreshold?: number;
  clinicalGroupHint?: string | null;
  estimatedPaymentGap?: number;
  detail?: string;
};

function parseSummary(json: string): {
  executiveSummary?: string;
  analyzerVersion?: string;
  lupa?: LupaSummary;
  llm?: { used?: boolean; provider?: string; model?: string; addedFindings?: number };
  originalReadiness?: number;
  expectedPeriodPayment?: number;
  paymentEstimate?: PaymentEstimateSummary;
} {
  try {
    return JSON.parse(json) as {
      executiveSummary?: string;
      analyzerVersion?: string;
      lupa?: LupaSummary;
      llm?: { used?: boolean; provider?: string; model?: string; addedFindings?: number };
      originalReadiness?: number;
      expectedPeriodPayment?: number;
      paymentEstimate?: PaymentEstimateSummary;
    };
  } catch {
    return {};
  }
}

function parseCategories(json: string): { category: string; count: number; impact: number }[] {
  try {
    return JSON.parse(json) as { category: string; count: number; impact: number }[];
  } catch {
    return [];
  }
}

export function ScanReport({
  scan,
  canResolve = false,
  showPilotCta = true,
}: {
  scan: ScanWithFindings;
  canResolve?: boolean;
  showPilotCta?: boolean;
}) {
  const summary = parseSummary(scan.summaryJson);
  const categories = parseCategories(scan.categoryStatsJson);
  // Live score from OPEN findings only — must match readiness path (not stale DB snapshot)
  const live = liveScoresFromFindings(scan.findings);
  const readiness = live.readiness;
  const clinicalScore = live.clinical;
  const complianceScore = live.compliance;
  const revenueScore = live.revenue;
  const analysisReadiness =
    summary.originalReadiness ?? scan.readinessScore ?? readiness;
  const scoreDrift =
    live.resolvedOrDismissed > 0 && analysisReadiness !== readiness;
  const openCritical = scan.findings.filter(
    (f) => f.status === "OPEN" && f.severity === "CRITICAL",
  ).length;
  const openHigh = scan.findings.filter(
    (f) => f.status === "OPEN" && f.severity === "HIGH",
  ).length;
  const openMedium = scan.findings.filter(
    (f) => f.status === "OPEN" && f.severity === "MEDIUM",
  ).length;
  const openLow = scan.findings.filter(
    (f) => f.status === "OPEN" && f.severity === "LOW",
  ).length;
  const lupa = summary.lupa;
  const pay = summary.paymentEstimate;
  const expectedPeriod =
    pay?.expectedPeriodPayment ??
    summary.expectedPeriodPayment ??
    CMS_NATIONAL_30_DAY_PERIOD_PAYMENT;
  const stripeEnabled = isStripePilotEnabled();

  return (
    <div className="app-page-enter space-y-6 print:space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <EmailReportForm token={scan.publicToken} defaultEmail={scan.contactEmail} />
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <ShareReportButton token={scan.publicToken} />
          <PrintButton />
          <a
            href={`/api/scans/${scan.publicToken}/csv`}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-navy shadow-sm transition hover:-translate-y-0.5 hover:bg-mist"
          >
            CSV
          </a>
          <a
            href={`/api/scans/${scan.publicToken}`}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-navy shadow-sm transition hover:-translate-y-0.5 hover:bg-mist"
            target="_blank"
            rel="noreferrer"
          >
            JSON
          </a>
        </div>
      </div>

      {/* Header band */}
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm transition hover:shadow-md print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
              Clinical Revenue Integrity · Chart Scan Report
            </p>
            <h1 className="mt-2 font-display text-3xl text-navy">Submission Readiness Review</h1>
            <p className="mt-2 text-sm text-muted">
              {scan.agencyNameHint || scan.agency?.name || "Agency"} ·{" "}
              {scan.patientLabel ? `Episode: ${scan.patientLabel}` : "Episode packet"}
              {scan.clinicianHint ? ` · Clinician: ${scan.clinicianHint}` : ""} ·{" "}
              {scan.periodStartHint ?? "Period not detected"} · {formatDate(scan.completedAt)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="navy">{scan.type} SCAN</Badge>
              <Badge tone={scan.status === "COMPLETE" ? "ok" : "warn"}>{scan.status}</Badge>
              {summary.analyzerVersion ? (
                <Badge tone="neutral">{summary.analyzerVersion}</Badge>
              ) : null}
              {scan.durationMs != null ? (
                <Badge tone="neutral">
                  {scan.durationMs < 1000
                    ? `${scan.durationMs}ms`
                    : `${(scan.durationMs / 1000).toFixed(1)}s`}{" "}
                  analysis
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="grid w-full min-w-[240px] gap-3 sm:max-w-xl sm:grid-cols-3">
            <div
              className="rounded-xl border border-navy/15 bg-mist/80 px-4 py-3 text-right sm:text-left"
              title={pay?.basis ?? "Chart-specific expected 30-day period payment"}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-navy">
                Expected period total
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-navy">
                {formatCurrency(expectedPeriod)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">
                {pay
                  ? `Weight ${pay.caseMixWeight.toFixed(2)} · ${pay.clinicalGroupFamily}${
                      pay.hippsHint ? ` · HIPPS ${pay.hippsHint}` : ""
                    }`
                  : `CMS CY ${CMS_PAYMENT_YEAR} model · this 30-day period`}
              </p>
            </div>
            <a
              href="#findings&money=RECOVERY&status=OPEN"
              className="rounded-xl border border-ok/25 bg-emerald-50/80 px-4 py-3 text-right transition hover:border-ok/50 hover:shadow-sm sm:text-left"
              title="Filter capture findings"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ok">
                Recoverable if fixed
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-ok">
                {formatCurrency(
                  scan.revenueUpside ??
                    (summary as { revenueUpside?: number }).revenueUpside,
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">Capture · upside vs base</p>
            </a>
            <a
              href="#findings&money=EXPOSURE&status=OPEN"
              className="rounded-xl border border-danger/20 bg-red-50/70 px-4 py-3 text-right transition hover:border-danger/40 hover:shadow-sm sm:text-left"
              title="Filter protect findings"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-danger">
                At risk if submitted
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-danger">
                {formatCurrency(scan.revenueAtRisk)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">Protect · of period total</p>
            </a>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          <strong className="text-navy">Expected period total</strong> is chart-specific: CMS CY{" "}
          {CMS_PAYMENT_YEAR} national base ({formatCurrency(CMS_NATIONAL_30_DAY_PERIOD_PAYMENT)}) ×
          inferred case-mix weight
          {pay ? ` ${pay.caseMixWeight.toFixed(3)}` : ""} × wage index
          {pay ? ` ${pay.wageIndex.toFixed(3)}` : " 1.000"}
          {pay?.confidence ? ` · confidence ${pay.confidence}` : ""}. Capture and protect are
          scaled to that period total. Not a certified grouper or remittance — actual claim =
          HIPPS × full CMS weight tables × agency wage index. A certification period may include
          two 30-day payments.
          {pay?.basis ? (
            <>
              <br />
              <span className="text-[11px]">Basis: {pay.basis}</span>
            </>
          ) : null}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-8 sm:justify-start">
          <ScoreRing
            score={readiness}
            label="Submission readiness"
            size={100}
            href={
              readiness < READINESS_GATE
                ? "#readiness-path"
                : "#findings&status=OPEN"
            }
            emphasize={readiness < READINESS_GATE}
            hint={
              readiness < READINESS_GATE
                ? `Below ${READINESS_GATE} · click to fix`
                : "At gate · view open"
            }
          />
          <ScoreRing
            score={clinicalScore}
            label="Clinical integrity"
            href="#findings&module=CLINICAL&status=OPEN"
          />
          <ScoreRing
            score={complianceScore}
            label="Compliance"
            href="#findings&module=COMPLIANCE&status=OPEN"
          />
          <ScoreRing
            score={revenueScore}
            label="Revenue intelligence"
            href="#findings&module=REVENUE&status=OPEN"
          />
        </div>

        {scoreDrift ? (
          <p className="no-print mt-3 text-xs text-muted">
            Live readiness <strong className="text-navy">{readiness}</strong> reflects{" "}
            {live.openCount} open finding{live.openCount === 1 ? "" : "s"}
            {live.resolvedOrDismissed > 0
              ? ` (${live.resolvedOrDismissed} resolved/dismissed no longer counted)`
              : ""}
            . Analysis snapshot was {analysisReadiness}/100.
          </p>
        ) : null}

        {readiness < READINESS_GATE ? (
          <div className="no-print mt-4 rounded-lg border border-warn/30 bg-amber-50 px-4 py-3 text-sm text-navy">
            Readiness is under the <strong>{READINESS_GATE}</strong> submission gate.{" "}
            <a href="#readiness-path" className="font-semibold text-teal hover:underline">
              Open the correction path
            </a>{" "}
            — ordered fixes that lift the score above {READINESS_GATE}.
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              {
                label: "Critical open",
                n: openCritical,
                tone: "danger" as const,
                href: "#findings&severity=CRITICAL&status=OPEN",
              },
              {
                label: "High open",
                n: openHigh,
                tone: "warn" as const,
                href: "#findings&severity=HIGH&status=OPEN",
              },
              {
                label: "Medium open",
                n: openMedium,
                tone: "navy" as const,
                href: "#findings&severity=MEDIUM&status=OPEN",
              },
              {
                label: "Low open",
                n: openLow,
                tone: "neutral" as const,
                href: "#findings&severity=LOW&status=OPEN",
              },
            ] as const
          ).map((row) => (
            <a
              key={row.label}
              href={row.href}
              className="rounded-xl border border-border bg-paper px-4 py-3 transition hover:border-teal/40 hover:shadow-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {row.label}
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-navy">{row.n}</p>
              <Badge tone={row.tone} className="mt-1">
                open
              </Badge>
            </a>
          ))}
        </div>
      </div>

      {/* Executive summary */}
      <Card>
        <CardHeader title="Executive summary" subtitle="What a senior revenue integrity specialist would lead with" />
        <div className="px-5 py-4">
          <p className="text-[14.5px] leading-relaxed text-ink/90">
            {summary.executiveSummary ?? "Analysis complete."}
          </p>
          <p className="mt-4 text-xs text-muted">
            Human-in-the-loop: AI surfaces and prioritizes findings. Clinicians and QA accept,
            override, or resolve before submission. This is not QA software theater — every finding
            ties to documentation quality, compliance risk, or dollars.
          </p>
          {summary.llm?.used ? (
            <p className="mt-2 text-xs text-muted">
              LLM enrichment: {summary.llm.provider}/{summary.llm.model}
              {summary.llm.addedFindings != null
                ? ` · +${summary.llm.addedFindings} findings`
                : ""}
            </p>
          ) : null}
        </div>
      </Card>

      {lupa && lupa.risk && lupa.risk !== "NONE" ? (
        <Card className="border-warn/30">
          <CardHeader
            title="LUPA risk assessment"
            subtitle="Advisory PDGM utilization model · confirm HIPPS-specific threshold"
          />
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-4">
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted">Risk</p>
              <p className="mt-1 text-sm font-bold text-navy">{lupa.risk}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted">Visits</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-navy">
                {lupa.effectiveVisits ?? "—"} / thr {lupa.assumedThreshold ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted">Group family</p>
              <p className="mt-1 text-sm font-semibold text-navy">
                {lupa.clinicalGroupHint ?? "DEFAULT"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted">Est. gap</p>
              <p className="mt-1 text-sm font-bold tabular-nums text-danger">
                {formatCurrency(lupa.estimatedPaymentGap)}
              </p>
            </div>
          </div>
          {lupa.detail ? (
            <p className="border-t border-border px-5 py-3 text-sm text-muted">{lupa.detail}</p>
          ) : null}
        </Card>
      ) : null}

      {/* Risk distribution */}
      {categories.length > 0 ? (
        <Card>
          <CardHeader title="Risk distribution" subtitle="Issue categories by estimated impact" />
          <div className="divide-y divide-border">
            {categories.map((c) => {
              const recovery = (c as { recovery?: number }).recovery ?? 0;
              const exposure = (c as { exposure?: number }).exposure ?? 0;
              return (
                <div
                  key={c.category}
                  className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-navy">{c.category}</p>
                    <p className="text-xs text-muted">
                      {c.count} finding{c.count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    {recovery > 0 ? (
                      <p className="font-semibold tabular-nums text-ok">
                        +{formatCurrency(recovery)} capture
                      </p>
                    ) : null}
                    {exposure > 0 ? (
                      <p className="font-semibold tabular-nums text-danger">
                        {formatCurrency(exposure)} protect
                      </p>
                    ) : null}
                    {recovery <= 0 && exposure <= 0 ? (
                      <p className="font-semibold tabular-nums text-navy">
                        {formatCurrency(c.impact)}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {scan.documents && scan.documents.length > 0 ? (
        <DocumentsPanel documents={scan.documents} />
      ) : null}

      <ResolutionProgress
        open={scan.findings.filter((f) => f.status === "OPEN").length}
        resolved={scan.findings.filter((f) => f.status === "RESOLVED").length}
        dismissed={scan.findings.filter((f) => f.status === "DISMISSED").length}
      />

      <ReadinessPath
        findings={scan.findings}
        baselineReadiness={readiness}
        analysisReadiness={analysisReadiness}
        canResolve={canResolve}
        scanToken={scan.publicToken}
      />

      <PaymentBreakdown
        payment={pay}
        capture={
          scan.revenueUpside ??
          (summary as { revenueUpside?: number }).revenueUpside ??
          0
        }
        protect={scan.revenueAtRisk ?? 0}
      />

      {/* QA → field nurse correction handoff */}
      <div id="send-to-field">
        <SendToFieldForm
          scanToken={scan.publicToken}
          findings={scan.findings}
          defaultNurseName={scan.clinicianHint ?? ""}
          defaultNurseEmail=""
        />
      </div>

      <FindingsPanel
        findings={scan.findings}
        canResolve={canResolve}
        scanToken={scan.publicToken}
      />

      <div className="no-print">
        <CmsRateCard />
      </div>

      {showPilotCta ? (
        <div className="no-print rounded-2xl border border-navy/10 bg-navy px-6 py-8 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
            Convert to pilot
          </p>
          <h2 className="mt-2 font-display text-2xl">
            Every episode evaluated before it is submitted.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">
            This free scan showed{" "}
            <span className="font-semibold text-emerald-300">
              {formatCurrency(scan.revenueUpside)} capture
            </span>{" "}
            and{" "}
            <span className="font-semibold text-red-200">
              {formatCurrency(scan.revenueAtRisk)} protect
            </span>{" "}
            on one episode. A 30-day pilot runs the same integrity pass on ongoing volume —
            clinician scorecards, issue worklist, EMR-agnostic.
          </p>
          <div className="mt-6">
            <PilotCtaForm
              token={scan.publicToken}
              defaultEmail={scan.contactEmail}
              defaultName={scan.contactName}
              defaultAgency={scan.agencyNameHint}
              stripeEnabled={stripeEnabled}
            />
          </div>
        </div>
      ) : null}

      <p className="text-center text-[11px] text-muted print:mt-6">
        Advisory only · Not a certified CMS HIPPS grouper · Do not submit claims based solely on AI
        output · PHI handling requires BAA for identifiable production use
      </p>
    </div>
  );
}
