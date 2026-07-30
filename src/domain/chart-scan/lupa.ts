/**
 * PDGM LUPA threshold reference (illustrative / advisory).
 * Real thresholds vary by HIPPS; refine with current CMS rate tables.
 */

import { CMS_LUPA_ILLUSTRATIVE_GAP } from "./knowledge";

export type LupaAssessment = {
  visitsCompleted: number | null;
  visitsScheduled: number | null;
  /** Best-effort visit total for the 30-day period */
  effectiveVisits: number | null;
  /** Assumed threshold when HIPPS unknown (conservative mid band) */
  assumedThreshold: number;
  hippsHint: string | null;
  clinicalGroupHint: string | null;
  risk: "NONE" | "BORDERLINE" | "LIKELY_LUPA" | "UNKNOWN";
  visitsBelowThreshold: number | null;
  estimatedPaymentGap: number;
  detail: string;
};

/** Common PDGM LUPA thresholds by clinical group family (simplified advisory table). */
export const LUPA_THRESHOLDS_BY_GROUP: Record<string, number> = {
  MMTA: 4,
  NEURO: 5,
  WOUND: 5,
  COMPLEX: 6,
  MS_REHAB: 5,
  BEHAVIORAL: 4,
  DEFAULT: 5,
};

/** CMS-derived full period vs LUPA per-visit gap (national SN × 5 threshold band). */
export const LUPA_PERIOD_GAP_DEFAULT = CMS_LUPA_ILLUSTRATIVE_GAP;

function numFrom(text: string, re: RegExp): number | null {
  const m = text.match(re);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function inferClinicalGroupFamily(text: string): string {
  const t = text.toLowerCase();
  if (/wound|pressure ulcer|m1306|ulcer/i.test(t)) return "WOUND";
  if (/neuro|stroke|cva|parkinson|ms\b|gait/i.test(t)) return "NEURO";
  if (/complex|iv |infusion|tpn/i.test(t)) return "COMPLEX";
  if (/pt:|physical therapy|ms rehab|rehab/i.test(t)) return "MS_REHAB";
  if (/behavior|psych|depression|anxiety/i.test(t)) return "BEHAVIORAL";
  if (/heart failure|chf|copd|diabetes|mmta|medication/i.test(t)) return "MMTA";
  return "DEFAULT";
}

export function extractHippsHint(text: string): string | null {
  const m = text.match(/\bHIPPS[:\s]*([A-Z0-9]{5})\b/i);
  return m?.[1]?.toUpperCase() ?? null;
}

function sumVisitTokens(line: string): number | null {
  // "3 SN + 2 PT" or "SN x2, PT x1"
  const plusParts = [...line.matchAll(/(\d+)\s*(?:SN|PT|OT|ST|MSW)\b/gi)];
  if (plusParts.length > 0) {
    const sum = plusParts.reduce((s, m) => s + Number(m[1]), 0);
    if (sum > 0 && sum < 100) return sum;
  }
  const xParts = [...line.matchAll(/(?:SN|PT|OT|ST|MSW)\s*[x×]\s*(\d+)/gi)];
  if (xParts.length > 0) {
    const sum = xParts.reduce((s, m) => s + Number(m[1]), 0);
    if (sum > 0 && sum < 100) return sum;
  }
  return null;
}

export function assessLupaRisk(text: string): LupaAssessment {
  // Prefer structured lines; never treat "30-day" as a visit count
  let visitsCompleted: number | null = null;
  const completedLine = text.match(
    /visits completed[^\n]{0,80}/i,
  )?.[0];
  if (completedLine) {
    visitsCompleted =
      sumVisitTokens(completedLine) ??
      numFrom(completedLine, /to date:\s*(\d+)/i) ??
      numFrom(completedLine, /:\s*(\d+)(?!\s*-?\s*day)/i);
  }

  const visitsScheduled =
    numFrom(text, /visits scheduled[^\n]{0,60}?:\s*(\d+)/i) ??
    numFrom(text, /scheduled for (?:the )?30-day period:\s*(\d+)/i) ??
    numFrom(text, /visits scheduled(?![^\n]{0,20}30-day)[^\d]{0,40}(\d+)/i);
  const skilledTotal =
    numFrom(text, /(\d+)\s+total skilled visits/i) ??
    numFrom(text, /skilled visits[^\d]{0,20}(\d+)(?!\s*-?\s*day)/i);

  const candidates = [visitsCompleted, visitsScheduled, skilledTotal].filter(
    (n): n is number => n !== null && n > 0 && n < 100,
  );
  // Prefer completed when present (what already happened in the period)
  const effectiveVisits =
    visitsCompleted != null && visitsCompleted > 0 && visitsCompleted < 100
      ? visitsCompleted
      : candidates.length > 0
        ? Math.min(...candidates)
        : null;

  const family = inferClinicalGroupFamily(text);
  const assumedThreshold = LUPA_THRESHOLDS_BY_GROUP[family] ?? LUPA_THRESHOLDS_BY_GROUP.DEFAULT;
  const hippsHint = extractHippsHint(text);

  if (effectiveVisits === null) {
    const mentionsBorderline = /lupa|borderline/i.test(text);
    return {
      visitsCompleted,
      visitsScheduled,
      effectiveVisits: null,
      assumedThreshold,
      hippsHint,
      clinicalGroupHint: family,
      risk: mentionsBorderline ? "BORDERLINE" : "UNKNOWN",
      visitsBelowThreshold: null,
      estimatedPaymentGap: mentionsBorderline ? LUPA_PERIOD_GAP_DEFAULT * 0.5 : 0,
      detail: mentionsBorderline
        ? "Chart mentions LUPA/borderline utilization without a clear visit total."
        : "Could not parse skilled visit counts for LUPA modeling.",
    };
  }

  const visitsBelowThreshold = Math.max(0, assumedThreshold - effectiveVisits);
  let risk: LupaAssessment["risk"] = "NONE";
  if (effectiveVisits <= assumedThreshold) risk = "LIKELY_LUPA";
  else if (effectiveVisits === assumedThreshold + 1) risk = "BORDERLINE";

  const gap =
    risk === "LIKELY_LUPA"
      ? LUPA_PERIOD_GAP_DEFAULT
      : risk === "BORDERLINE"
        ? Math.round(LUPA_PERIOD_GAP_DEFAULT * 0.45)
        : 0;

  return {
    visitsCompleted,
    visitsScheduled,
    effectiveVisits,
    assumedThreshold,
    hippsHint,
    clinicalGroupHint: family,
    risk,
    visitsBelowThreshold: risk === "NONE" ? 0 : visitsBelowThreshold || 1,
    estimatedPaymentGap: gap,
    detail:
      risk === "LIKELY_LUPA"
        ? `Effective skilled visits (${effectiveVisits}) at/under assumed LUPA threshold (${assumedThreshold}) for ${family} family${hippsHint ? ` · HIPPS ${hippsHint}` : ""}.`
        : risk === "BORDERLINE"
          ? `Effective skilled visits (${effectiveVisits}) are one above assumed threshold (${assumedThreshold}) for ${family} — schedule risk.`
          : `Visit volume (${effectiveVisits}) appears above assumed LUPA threshold (${assumedThreshold}) for ${family}.`,
  };
}
