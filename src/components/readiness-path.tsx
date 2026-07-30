"use client";

import { useMemo, useState } from "react";
import type { ChartFinding } from "@prisma/client";
import {
  READINESS_GATE,
  minimalPathToGate,
  readinessFromFindings,
  type ScoreableFinding,
} from "@/domain/chart-scan/readiness-path";
import { formatCurrency } from "@/lib/utils";
import { Badge, Button, Card, CardHeader } from "./ui";
import { ModuleBadge, SeverityBadge } from "./severity-badge";
import { updateFindingStatusAction } from "@/server/actions/scans";

function toScoreable(f: ChartFinding): ScoreableFinding {
  return {
    id: f.id,
    module: f.module,
    severity: f.severity,
    status: f.status,
    title: f.title,
    category: f.category,
    suggestedCorrection: f.suggestedCorrection,
    description: f.description,
    estimatedImpact: f.estimatedImpact,
    impactType: f.impactType,
    cmsReference: f.cmsReference,
  };
}

/**
 * When readiness < 80: ranked correction path so the chart can clear the gate.
 * Clicking the readiness score scrolls here (#readiness-path).
 */
export function ReadinessPath({
  findings,
  baselineReadiness,
  analysisReadiness,
  canResolve,
  scanToken,
}: {
  findings: ChartFinding[];
  /** Current readiness (open findings) — same number as the score ring */
  baselineReadiness: number;
  /** Original analysis snapshot if different from live */
  analysisReadiness?: number;
  canResolve: boolean;
  scanToken: string;
}) {
  const scoreable = useMemo(() => findings.map(toScoreable), [findings]);
  const live = useMemo(() => {
    const open = scoreable.filter((f) => f.status === "OPEN");
    return readinessFromFindings(open).readiness;
  }, [scoreable]);

  // Prefer parent-passed score so ring and path cannot drift
  const current = baselineReadiness;

  const path = useMemo(
    () => minimalPathToGate(scoreable, READINESS_GATE),
    [scoreable],
  );

  const [expanded, setExpanded] = useState(true);
  const belowGate = current < READINESS_GATE;
  const show = current < READINESS_GATE || belowGate || (analysisReadiness != null && analysisReadiness < READINESS_GATE);
  if (!show) return null;

  const openCount = scoreable.filter((f) => f.status === "OPEN").length;

  const pctTowardGate = Math.min(
    100,
    Math.round((current / READINESS_GATE) * 100),
  );

  return (
    <div id="readiness-path" className="scroll-mt-24">
      <Card
        className={
          belowGate
            ? "border-warn/40 shadow-sm ring-1 ring-warn/20"
            : "border-ok/40 shadow-sm ring-1 ring-ok/20"
        }
      >
        <CardHeader
          title={
            belowGate
              ? `Path to readiness ${READINESS_GATE}+`
              : `Readiness gate cleared (${current}/100)`
          }
          subtitle={
            belowGate
              ? `Now ${current}/100 · resolve the steps below to reach ${READINESS_GATE} before submission`
              : "Document fixes in the chart, then re-scan or mark findings resolved"
          }
          action={
            <button
              type="button"
              className="text-xs font-semibold text-teal hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          }
        />

        {expanded ? (
          <div className="space-y-4 px-5 pb-5">
            {/* Score meter — same number as the readiness ring */}
            <div className="rounded-xl border border-border bg-paper px-4 py-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Current readiness (open findings)
                  </p>
                  <p
                    className={`mt-1 text-3xl font-bold tabular-nums ${
                      current >= READINESS_GATE ? "text-ok" : "text-danger"
                    }`}
                  >
                    {current}
                    <span className="text-base font-medium text-muted">/100</span>
                  </p>
                  {analysisReadiness != null && analysisReadiness !== current ? (
                    <p className="mt-1 text-[11px] text-muted">
                      Original analysis score: {analysisReadiness}/100 (before resolves)
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-navy">Gate {READINESS_GATE}</p>
                  <p className="text-xs text-muted">
                    {belowGate
                      ? `${READINESS_GATE - current} points to clear`
                      : "At or above threshold"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    If all open fixed → ~{path.projectedIfAllFixed}
                  </p>
                </div>
              </div>
              <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-white">
                <div
                  className={`h-full rounded-full transition-all ${
                    current >= READINESS_GATE ? "bg-ok" : "bg-warn"
                  }`}
                  style={{ width: `${pctTowardGate}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted">
                Same score as the ring above. Resolved/dismissed findings no longer count against
                readiness.
                {canResolve
                  ? " Mark steps fixed as chart docs are updated — score updates live."
                  : " Open this report link to mark findings fixed."}
              </p>
            </div>

            {!belowGate ? (
              <div className="rounded-lg border border-ok/30 bg-emerald-50 px-4 py-3 text-sm text-navy">
                Open findings no longer drag readiness under {READINESS_GATE}. Confirm documentation
                is updated in the EMR, then re-run a scan if you need a fresh packet score.
              </div>
            ) : (
              <ol className="space-y-3">
                {path.steps.map((step, idx) => {
                  const current = findings.find((x) => x.id === step.id);
                  const done = current ? current.status !== "OPEN" : false;
                  return (
                    <li
                      key={step.id}
                      id={`fix-${step.id}`}
                      className={`rounded-xl border px-4 py-3 ${
                        step.crossesGate
                          ? "border-teal/40 bg-teal/5"
                          : done
                            ? "border-ok/25 bg-emerald-50/50 opacity-80"
                            : "border-border bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-muted">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                            <SeverityBadge severity={step.severity} />
                            <ModuleBadge module={step.module} />
                            {step.crossesGate ? (
                              <Badge tone="teal">Clears {READINESS_GATE}+</Badge>
                            ) : null}
                            {done ? <Badge tone="ok">Done</Badge> : null}
                          </div>
                          <p className="mt-2 text-sm font-semibold text-navy">{step.title}</p>
                          <p className="mt-1 text-xs font-medium text-muted">{step.category}</p>
                          <div className="mt-3 rounded-lg border border-teal/20 bg-teal/5 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-teal">
                              Correction path
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-ink/90">
                              {step.suggestedCorrection}
                            </p>
                          </div>
                          {step.cmsReference ? (
                            <p className="mt-2 text-[11px] text-muted">
                              CMS ref: {step.cmsReference}
                            </p>
                          ) : null}
                          {step.estimatedImpact != null && step.estimatedImpact > 0 ? (
                            <p className="mt-1 text-[11px] text-muted">
                              Est. $ impact: {formatCurrency(step.estimatedImpact)} (
                              {step.impactType === "RECOVERY" ? "capture" : "protect"})
                            </p>
                          ) : null}
                          <p className="mt-2 text-[11px] font-medium text-navy">
                            Readiness if fixed through this step →{" "}
                            <span className="tabular-nums">
                              {step.readinessIfResolvedThroughHere}/100
                            </span>
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          <a
                            href={`#finding-${step.id}`}
                            className="text-center text-xs font-semibold text-teal hover:underline"
                          >
                            Full finding →
                          </a>
                          {canResolve && !done ? (
                            <form action={updateFindingStatusAction}>
                              <input type="hidden" name="findingId" value={step.id} />
                              <input type="hidden" name="status" value="RESOLVED" />
                              <input type="hidden" name="scanToken" value={scanToken} />
                              <Button type="submit" size="sm" className="w-full">
                                Mark fixed
                              </Button>
                            </form>
                          ) : null}
                          {canResolve && !done ? (
                            <form action={updateFindingStatusAction}>
                              <input type="hidden" name="findingId" value={step.id} />
                              <input type="hidden" name="status" value="DISMISSED" />
                              <Button type="submit" size="sm" variant="secondary" className="w-full">
                                Dismiss
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {belowGate && path.steps.length < openCount ? (
              <p className="text-xs text-muted">
                Showing the shortest severity-ranked path to {READINESS_GATE}+.{" "}
                {openCount - path.steps.length} additional open finding
                {openCount - path.steps.length === 1 ? "" : "s"} remain in the full list below.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3 text-xs font-semibold">
              <a href="#findings&status=OPEN" className="text-teal hover:underline">
                All open findings →
              </a>
              <a href="#findings&severity=CRITICAL&status=OPEN" className="text-teal hover:underline">
                Critical only →
              </a>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
