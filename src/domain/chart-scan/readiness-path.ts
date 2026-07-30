/**
 * Path-to-threshold: when readiness < gate, rank open findings by score drag
 * and project readiness if they are resolved.
 */

export const READINESS_GATE = 80;

const SEVERITY_WEIGHT: Record<string, number> = {
  CRITICAL: 22,
  HIGH: 12,
  MEDIUM: 6,
  LOW: 2,
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export type ScoreableFinding = {
  id: string;
  module: string;
  severity: string;
  status: string;
  title: string;
  category: string;
  suggestedCorrection: string;
  description?: string | null;
  estimatedImpact?: number | null;
  impactType?: string | null;
  cmsReference?: string | null;
};

function moduleScore(
  findings: ScoreableFinding[],
  module: string,
): number {
  const subset = findings.filter((f) => f.module === module);
  if (subset.length === 0) return 92;
  const penalty = subset.reduce(
    (sum, f) => sum + (SEVERITY_WEIGHT[f.severity] ?? 2),
    0,
  );
  return clamp(100 - penalty);
}

/** Same weighting as analyzer computeScores */
export function readinessFromFindings(findings: ScoreableFinding[]): {
  clinical: number;
  compliance: number;
  revenue: number;
  readiness: number;
} {
  const clinical = moduleScore(findings, "CLINICAL");
  const compliance = moduleScore(findings, "COMPLIANCE");
  const revenue = moduleScore(findings, "REVENUE");
  const readiness = clamp(clinical * 0.35 + compliance * 0.4 + revenue * 0.25);
  return { clinical, compliance, revenue, readiness };
}

/**
 * Live report score = OPEN findings only (resolved/dismissed no longer drag readiness).
 * Use this everywhere on the report so the ring and path never disagree.
 */
export function liveScoresFromFindings(
  findings: Array<{
    module: string;
    severity: string;
    status: string;
    id?: string;
    title?: string;
    category?: string;
    suggestedCorrection?: string;
  }>,
): {
  clinical: number;
  compliance: number;
  revenue: number;
  readiness: number;
  openCount: number;
  resolvedOrDismissed: number;
} {
  const open = findings.filter((f) => f.status === "OPEN");
  const scores = readinessFromFindings(
    open.map((f, i) => ({
      id: f.id ?? String(i),
      module: f.module,
      severity: f.severity,
      status: f.status,
      title: f.title ?? "",
      category: f.category ?? "",
      suggestedCorrection: f.suggestedCorrection ?? "",
    })),
  );
  return {
    ...scores,
    openCount: open.length,
    resolvedOrDismissed: findings.length - open.length,
  };
}

export function openFindingsOnly(findings: ScoreableFinding[]): ScoreableFinding[] {
  return findings.filter((f) => f.status === "OPEN");
}

/** Severity drag used for ordering the fix path */
export function findingPenalty(f: ScoreableFinding): number {
  return SEVERITY_WEIGHT[f.severity] ?? 2;
}

/**
 * Order open findings so resolving top items lifts readiness fastest.
 * Compliance weighted slightly higher (matches readiness formula).
 */
export function orderFixPath(findings: ScoreableFinding[]): ScoreableFinding[] {
  const open = openFindingsOnly(findings);
  const moduleBoost: Record<string, number> = {
    COMPLIANCE: 1.15,
    CLINICAL: 1.05,
    REVENUE: 1,
  };
  return [...open].sort((a, b) => {
    const wa = findingPenalty(a) * (moduleBoost[a.module] ?? 1);
    const wb = findingPenalty(b) * (moduleBoost[b.module] ?? 1);
    if (wb !== wa) return wb - wa;
    return (b.estimatedImpact ?? 0) - (a.estimatedImpact ?? 0);
  });
}

/**
 * Greedy: minimum ordered fixes to reach gate (or all if still short).
 */
export function minimalPathToGate(
  findings: ScoreableFinding[],
  gate = READINESS_GATE,
): {
  current: number;
  target: number;
  steps: Array<
    ScoreableFinding & {
      readinessIfResolvedThroughHere: number;
      crossesGate: boolean;
    }
  >;
  projectedIfAllFixed: number;
  enoughToPass: boolean;
} {
  const ordered = orderFixPath(findings);
  const open = openFindingsOnly(findings);
  const current = readinessFromFindings(open).readiness;
  const projectedIfAllFixed = readinessFromFindings(
    findings.filter((f) => f.status !== "OPEN"),
  ).readiness;

  const remaining = new Set(open.map((f) => f.id));
  const steps: Array<
    ScoreableFinding & {
      readinessIfResolvedThroughHere: number;
      crossesGate: boolean;
    }
  > = [];

  let crossed = current >= gate;
  for (const f of ordered) {
    remaining.delete(f.id);
    const stillOpen = open.filter((x) => remaining.has(x.id));
    const next = readinessFromFindings(stillOpen).readiness;
    const crossesGate = !crossed && next >= gate;
    if (crossesGate) crossed = true;
    steps.push({
      ...f,
      readinessIfResolvedThroughHere: next,
      crossesGate,
    });
    // Keep listing remaining for transparency even after gate — UI can highlight gate step
  }

  // Trim display path: include until gate is crossed + one buffer, min all critical/high
  let path = steps;
  const gateIdx = steps.findIndex((s) => s.crossesGate);
  if (gateIdx >= 0) {
    path = steps.slice(0, Math.min(steps.length, gateIdx + 1));
    // Always keep any CRITICAL still in full list if gate needs more? path is enough
  }

  return {
    current,
    target: gate,
    steps: path.length > 0 ? path : steps,
    projectedIfAllFixed,
    enoughToPass: projectedIfAllFixed >= gate || current >= gate,
  };
}
