/**
 * Retrospective batch scoring: given known claim outcomes, did the analyzer
 * produce findings that would have flagged the risk before submission?
 */

import type { AnalysisFinding, AnalysisResult } from "@/domain/chart-scan/types";

export type KnownOutcome =
  | "PAID_CLEAN"
  | "DENIED"
  | "PARTIAL_DENIAL"
  | "LUPA"
  | "TAKEBACK"
  | "ADJUSTMENT"
  | "UNKNOWN";

export const ADVERSE_OUTCOMES: KnownOutcome[] = [
  "DENIED",
  "PARTIAL_DENIAL",
  "LUPA",
  "TAKEBACK",
  "ADJUSTMENT",
];

export function isAdverseOutcome(o: string): boolean {
  return ADVERSE_OUTCOMES.includes(o as KnownOutcome);
}

export function normalizeOutcome(raw: string | null | undefined): KnownOutcome {
  const s = (raw ?? "UNKNOWN").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (
    [
      "PAID_CLEAN",
      "PAID",
      "CLEAN",
      "ACCEPTED",
      "NO_ISSUE",
    ].includes(s)
  ) {
    return "PAID_CLEAN";
  }
  if (["DENIED", "DENIAL", "FULL_DENIAL", "REJECTED"].includes(s)) return "DENIED";
  if (["PARTIAL_DENIAL", "PARTIAL", "DOWNCODE", "REDUCTION"].includes(s)) {
    return "PARTIAL_DENIAL";
  }
  if (["LUPA", "LUPA_THRESHOLD"].includes(s)) return "LUPA";
  if (["TAKEBACK", "RECOUP", "RECOUPMENT", "OVERPAYMENT"].includes(s)) return "TAKEBACK";
  if (["ADJUSTMENT", "ADJ", "MEDICAL_REVIEW"].includes(s)) return "ADJUSTMENT";
  return "UNKNOWN";
}

/** Map free-text denial reasons / outcome types to finding category keywords */
const OUTCOME_CATEGORY_HINTS: Record<KnownOutcome, RegExp[]> = {
  PAID_CLEAN: [],
  DENIED: [
    /face-to-face|f2f/i,
    /homebound/i,
    /certif/i,
    /physician order|signature/i,
    /eligibility|coverage/i,
    /medical necessity|skilled need/i,
    /documentation/i,
  ],
  PARTIAL_DENIAL: [
    /comorbidity|case-mix|undercod|diagnosis/i,
    /coding/i,
    /wound/i,
    /functional|oasis/i,
    /medical necessity|skilled need/i,
  ],
  LUPA: [/lupa/i, /visit volume|skilled visit/i, /utilization/i],
  TAKEBACK: [
    /face-to-face|f2f/i,
    /homebound/i,
    /certif/i,
    /medical necessity/i,
    /documentation/i,
  ],
  ADJUSTMENT: [/comorbidity|case-mix|coding|diagnosis|pdgm/i],
  UNKNOWN: [],
};

function reasonHints(reason: string | null | undefined): RegExp[] {
  if (!reason?.trim()) return [];
  const r = reason.toLowerCase();
  const out: RegExp[] = [];
  if (/f2f|face.?to.?face|face to face/.test(r)) out.push(/face-to-face|f2f/i);
  if (/homebound/.test(r)) out.push(/homebound/i);
  if (/lupa/.test(r)) out.push(/lupa/i);
  if (/certif/.test(r)) out.push(/certif/i);
  if (/order|signature|signed/.test(r)) out.push(/order|signature/i);
  if (/wound|ulcer/.test(r)) out.push(/wound/i);
  if (/comorbid|hcc|coding|dx|diagnosis/.test(r)) out.push(/comorbidity|case-mix|coding|diagnosis/i);
  if (/visit|utilization/.test(r)) out.push(/lupa|visit/i);
  if (/necessity|skilled/.test(r)) out.push(/medical necessity|skilled need/i);
  return out;
}

export type CatchResult = {
  wouldHaveCaught: boolean | null;
  matchReason: string | null;
  matchedTitles: string[];
};

/**
 * Score whether analysis findings would have caught a known adverse outcome.
 * - Adverse outcome + matching HIGH/CRITICAL (or any EXPOSURE $) finding → caught
 * - PAID_CLEAN + CRITICAL findings → false pressure (still not "caught")
 * - UNKNOWN → null
 */
export function scoreWouldHaveCaught(params: {
  knownOutcome: KnownOutcome;
  knownReason?: string | null;
  findings: AnalysisFinding[];
}): CatchResult {
  const { knownOutcome, knownReason, findings } = params;

  if (knownOutcome === "UNKNOWN") {
    return { wouldHaveCaught: null, matchReason: "No known outcome labeled", matchedTitles: [] };
  }

  if (knownOutcome === "PAID_CLEAN") {
    const criticals = findings.filter((f) => f.severity === "CRITICAL");
    if (criticals.length > 0) {
      return {
        wouldHaveCaught: false,
        matchReason: `Paid clean but ${criticals.length} CRITICAL finding(s) — false pressure`,
        matchedTitles: criticals.map((f) => f.title).slice(0, 5),
      };
    }
    return {
      wouldHaveCaught: false,
      matchReason: "Paid clean — no adverse outcome to catch",
      matchedTitles: [],
    };
  }

  const patterns = [
    ...OUTCOME_CATEGORY_HINTS[knownOutcome],
    ...reasonHints(knownReason),
  ];

  const material = findings.filter(
    (f) =>
      f.severity === "CRITICAL" ||
      f.severity === "HIGH" ||
      (f.impactType === "EXPOSURE" && (f.estimatedImpact ?? 0) > 0),
  );

  if (material.length === 0) {
    return {
      wouldHaveCaught: false,
      matchReason: "No HIGH/CRITICAL or $ exposure findings",
      matchedTitles: [],
    };
  }

  // Prefer semantic match to known denial reason / outcome family
  const matched = material.filter((f) => {
    const blob = `${f.category} ${f.title} ${f.description}`;
    if (patterns.length === 0) return true;
    return patterns.some((re) => re.test(blob));
  });

  if (matched.length > 0) {
    return {
      wouldHaveCaught: true,
      matchReason: `Matched ${knownOutcome} via ${matched[0].category}: ${matched[0].title}`,
      matchedTitles: matched.map((f) => f.title).slice(0, 8),
    };
  }

  // Fallback: any critical exposure still counts as "would have flagged" for full denial/LUPA
  if (
    (knownOutcome === "DENIED" || knownOutcome === "LUPA" || knownOutcome === "TAKEBACK") &&
    material.some((f) => f.severity === "CRITICAL")
  ) {
    const c = material.find((f) => f.severity === "CRITICAL")!;
    return {
      wouldHaveCaught: true,
      matchReason: `CRITICAL flag present before submission (${c.category})`,
      matchedTitles: material.filter((f) => f.severity === "CRITICAL").map((f) => f.title).slice(0, 8),
    };
  }

  return {
    wouldHaveCaught: false,
    matchReason: `Findings present but none matched ${knownOutcome}${knownReason ? ` / ${knownReason}` : ""}`,
    matchedTitles: material.map((f) => f.title).slice(0, 5),
  };
}

export type BatchAggregate = {
  itemCount: number;
  processedCount: number;
  failedCount: number;
  adverseCount: number;
  caughtCount: number;
  missedCount: number;
  falsePressureCount: number;
  totalProtectUsd: number;
  totalCaptureUsd: number;
  knownLossUsd: number;
  recoverableUsd: number;
  catchRate: number | null;
  summary: string;
};

export function aggregateBatchItems(
  items: Array<{
    status: string;
    knownOutcome: string;
    knownLossUsd: number | null;
    wouldHaveCaught: boolean | null;
    revenueAtRisk: number | null;
    revenueUpside: number | null;
  }>,
): BatchAggregate {
  const processed = items.filter((i) => i.status === "COMPLETE");
  const failed = items.filter((i) => i.status === "FAILED");
  let adverseCount = 0;
  let caughtCount = 0;
  let missedCount = 0;
  let falsePressureCount = 0;
  let totalProtectUsd = 0;
  let totalCaptureUsd = 0;
  let knownLossUsd = 0;
  let recoverableUsd = 0;

  for (const i of processed) {
    totalProtectUsd += i.revenueAtRisk ?? 0;
    totalCaptureUsd += i.revenueUpside ?? 0;
    const outcome = normalizeOutcome(i.knownOutcome);
    if (isAdverseOutcome(outcome)) {
      adverseCount += 1;
      const loss = i.knownLossUsd ?? 0;
      knownLossUsd += loss;
      if (i.wouldHaveCaught === true) {
        caughtCount += 1;
        recoverableUsd += loss;
      } else if (i.wouldHaveCaught === false) {
        missedCount += 1;
      }
    } else if (outcome === "PAID_CLEAN" && i.wouldHaveCaught === false) {
      // false pressure encoded in matchReason path — count via optional flag in caller
    }
  }

  // false pressure: paid clean where matchReason mentions false pressure — approximate via wouldHaveCaught false + paid
  for (const i of processed) {
    if (normalizeOutcome(i.knownOutcome) === "PAID_CLEAN") {
      // counted separately if criticals; use knownLoss null and high protect as proxy only in report
    }
  }

  const catchRate =
    adverseCount > 0 ? Math.round((caughtCount / adverseCount) * 1000) / 10 : null;

  const summary =
    adverseCount === 0
      ? `Processed ${processed.length} claims without labeled adverse outcomes. Label denials/LUPA/takebacks to measure catch rate.`
      : `Would-have-caught ${caughtCount} of ${adverseCount} adverse claims (${catchRate}%). ` +
        `Missed ${missedCount}. Known loss labeled $${Math.round(knownLossUsd).toLocaleString()}; ` +
        `of which $${Math.round(recoverableUsd).toLocaleString()} sat on claims we would have flagged.`;

  return {
    itemCount: items.length,
    processedCount: processed.length,
    failedCount: failed.length,
    adverseCount,
    caughtCount,
    missedCount,
    falsePressureCount,
    totalProtectUsd: Math.round(totalProtectUsd),
    totalCaptureUsd: Math.round(totalCaptureUsd),
    knownLossUsd: Math.round(knownLossUsd),
    recoverableUsd: Math.round(recoverableUsd),
    catchRate,
    summary,
  };
}

export function summarizeResult(result: AnalysisResult) {
  return {
    readinessScore: result.scores.readiness,
    revenueAtRisk: result.revenueAtRisk,
    revenueUpside: result.revenueUpside,
    criticalCount: result.severityCounts.critical,
    highCount: result.severityCounts.high,
    titles: result.findings.map((f) => f.title),
    categories: [...new Set(result.findings.map((f) => f.category))],
    patientLabel: result.patientLabelHint,
  };
}
