import {
  CMS_NATIONAL_30_DAY_PERIOD_PAYMENT,
  CMS_PAYMENT_YEAR,
  DENIAL_CEILING_CATEGORIES,
  TYPICAL_PERIOD_PAYMENT,
} from "./knowledge";
import type { AnalysisFinding, CategoryStat, ImpactType, ModuleScores } from "./types";

const SEVERITY_WEIGHT: Record<AnalysisFinding["severity"], number> = {
  CRITICAL: 22,
  HIGH: 12,
  MEDIUM: 6,
  LOW: 2,
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function moduleScore(findings: AnalysisFinding[], module: AnalysisFinding["module"]): number {
  const subset = findings.filter((f) => f.module === module);
  if (subset.length === 0) return 92;
  const penalty = subset.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  return clamp(100 - penalty);
}

export function computeScores(findings: AnalysisFinding[]): ModuleScores {
  const clinical = moduleScore(findings, "CLINICAL");
  const compliance = moduleScore(findings, "COMPLIANCE");
  const revenue = moduleScore(findings, "REVENUE");
  const readiness = clamp(clinical * 0.35 + compliance * 0.4 + revenue * 0.25);
  return { clinical, compliance, revenue, readiness };
}

function isDenialCeilingFinding(f: AnalysisFinding): boolean {
  if (f.impactType === "RECOVERY") return false;
  if (DENIAL_CEILING_CATEGORIES.has(f.category)) return true;
  return /face-to-face|f2f|homebound|certification|physician order|signature/i.test(
    `${f.category} ${f.title}`,
  );
}

/** Infer impact type when missing (LLM / legacy). */
export function resolveImpactType(f: AnalysisFinding): ImpactType {
  if (f.impactType) return f.impactType;
  if (
    /comorbidity|case-mix|undercod|diagnosis specificity|coding support/i.test(
      `${f.category} ${f.title}`,
    )
  ) {
    return "RECOVERY";
  }
  if ((f.estimatedImpact ?? 0) <= 0) return "NEUTRAL";
  return "EXPOSURE";
}

/**
 * Downside $ — denial / LUPA / takeback if submitted as-is.
 * Denial-class: max once. Other exposure: sum. Cap = chart expected period (or national base).
 */
export function sumRevenueAtRisk(
  findings: AnalysisFinding[],
  periodCap: number = TYPICAL_PERIOD_PAYMENT,
): number {
  let denialCeiling = 0;
  let otherExposure = 0;
  const cap = periodCap > 0 ? periodCap : TYPICAL_PERIOD_PAYMENT;

  for (const f of findings) {
    const dollars = f.estimatedImpact ?? 0;
    if (dollars <= 0) continue;
    if (resolveImpactType(f) !== "EXPOSURE") continue;
    if (isDenialCeilingFinding(f)) {
      denialCeiling = Math.max(denialCeiling, dollars);
    } else {
      otherExposure += dollars;
    }
  }

  const raw = Math.max(denialCeiling, otherExposure);
  return Math.round(Math.min(raw, cap));
}

/**
 * Upside $ — undercoding / comorbidity / capture if documentation is completed correctly.
 * Additive, capped at chart expected period.
 */
export function sumRevenueUpside(
  findings: AnalysisFinding[],
  periodCap: number = TYPICAL_PERIOD_PAYMENT,
): number {
  let upside = 0;
  const cap = periodCap > 0 ? periodCap : TYPICAL_PERIOD_PAYMENT;
  for (const f of findings) {
    if (resolveImpactType(f) !== "RECOVERY") continue;
    upside += f.estimatedImpact ?? 0;
  }
  return Math.round(Math.min(upside, cap));
}

export function countBySeverity(findings: AnalysisFinding[]) {
  return {
    critical: findings.filter((f) => f.severity === "CRITICAL").length,
    high: findings.filter((f) => f.severity === "HIGH").length,
    medium: findings.filter((f) => f.severity === "MEDIUM").length,
    low: findings.filter((f) => f.severity === "LOW").length,
  };
}

export function buildCategoryStats(findings: AnalysisFinding[]): CategoryStat[] {
  const map = new Map<string, CategoryStat>();
  for (const f of findings) {
    const cur = map.get(f.category) ?? {
      category: f.category,
      count: 0,
      impact: 0,
      recovery: 0,
      exposure: 0,
    };
    const dollars = f.estimatedImpact ?? 0;
    cur.count += 1;
    cur.impact += dollars;
    const t = resolveImpactType(f);
    if (t === "RECOVERY") cur.recovery += dollars;
    if (t === "EXPOSURE") cur.exposure += dollars;
    map.set(f.category, cur);
  }
  return [...map.values()].sort(
    (a, b) => b.recovery + b.exposure - (a.recovery + a.exposure) || b.count - a.count,
  );
}

export function severityRank(s: AnalysisFinding["severity"]): number {
  switch (s) {
    case "CRITICAL":
      return 0;
    case "HIGH":
      return 1;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 3;
  }
}

export function sortFindings(findings: AnalysisFinding[]): AnalysisFinding[] {
  return [...findings].sort((a, b) => {
    const sr = severityRank(a.severity) - severityRank(b.severity);
    if (sr !== 0) return sr;
    // Prefer recovery and larger dollars for action priority after severity
    const typeRank = (t: ImpactType) => (t === "RECOVERY" ? 0 : t === "EXPOSURE" ? 1 : 2);
    const tr = typeRank(resolveImpactType(a)) - typeRank(resolveImpactType(b));
    if (tr !== 0) return tr;
    return (b.estimatedImpact ?? 0) - (a.estimatedImpact ?? 0);
  });
}

export function buildExecutiveSummary(params: {
  readiness: number;
  revenueAtRisk: number;
  revenueUpside: number;
  expectedPeriodPayment?: number;
  paymentBasis?: string;
  counts: ReturnType<typeof countBySeverity>;
  topTitles: string[];
}): string {
  const riskBand =
    params.readiness >= 85
      ? "strong submission readiness"
      : params.readiness >= 70
        ? "moderate readiness with actionable gaps"
        : params.readiness >= 50
          ? "elevated documentation and reimbursement risk"
          : "high risk of denial, LUPA, or underpayment if submitted as-is";

  const tops =
    params.topTitles.length > 0
      ? ` Priority focus: ${params.topTitles.slice(0, 3).join("; ")}.`
      : "";

  const expected =
    params.expectedPeriodPayment ?? CMS_NATIONAL_30_DAY_PERIOD_PAYMENT;
  const periodLabel = expected.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  const nationalLabel = CMS_NATIONAL_30_DAY_PERIOD_PAYMENT.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  return (
    `Submission Readiness Score is ${params.readiness}/100, indicating ${riskBand}. ` +
    `Expected full payment for this patient's 30-day PDGM period: ${periodLabel} ` +
    `(chart-specific case-mix model × wage index on CMS CY ${CMS_PAYMENT_YEAR} national base ${nationalLabel}` +
    `${params.paymentBasis ? `; ${params.paymentBasis}` : ""}). ` +
    `A certification period may include two 30-day payments. ` +
    `Estimated revenue at risk if submitted as-is (protect): ~$${Math.round(params.revenueAtRisk).toLocaleString()} of that period total. ` +
    `Estimated recoverable revenue if documentation is completed correctly (capture): ~$${Math.round(params.revenueUpside).toLocaleString()}. ` +
    `Findings: ${params.counts.critical} critical, ${params.counts.high} high, ` +
    `${params.counts.medium} medium, ${params.counts.low} low.` +
    tops +
    ` Human review is required before submission. Not a CMS payment determination or certified HIPPS grouper.`
  );
}
