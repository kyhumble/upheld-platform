/**
 * Phase 2 payment intelligence — chart-specific expected 30-day period payment.
 *
 * Method (advisory, not a certified CMS grouper):
 *   expectedPeriodPayment = CMS_national_30_day_base × caseMixWeight × wageIndex
 *
 * caseMixWeight is inferred from packet signals:
 *   clinical group family · comorbidity band · functional band · timing · admission source
 * If HIPPS is present, a compact public-style weight table is preferred when known.
 *
 * Wage index defaults to 1.0 (national). Set AGENCY_WAGE_INDEX for agency-local estimate.
 */

import {
  CMS_NATIONAL_30_DAY_PERIOD_PAYMENT,
  CMS_PAYMENT_YEAR,
  CMS_PER_VISIT_RATES_2026,
} from "./knowledge";
import { extractHippsHint, inferClinicalGroupFamily } from "./lupa";

export type ComorbidityBand = "NONE" | "LOW" | "HIGH" | "UNKNOWN";
export type FunctionalBand = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
export type TimingBand = "EARLY" | "LATE" | "UNKNOWN";
export type AdmissionSource = "COMMUNITY" | "INSTITUTIONAL" | "UNKNOWN";

export type PaymentEstimate = {
  /** Final advisory expected full PDGM period payment for this chart */
  expectedPeriodPayment: number;
  /** CMS national base before multipliers */
  nationalBase: number;
  paymentYear: number;
  caseMixWeight: number;
  wageIndex: number;
  clinicalGroupFamily: string;
  comorbidityBand: ComorbidityBand;
  functionalBand: FunctionalBand;
  timing: TimingBand;
  admissionSource: AdmissionSource;
  hippsHint: string | null;
  /** How the weight was derived */
  method: "hipps_table" | "signal_model" | "national_only";
  /** Human-readable basis for the report */
  basis: string;
  /** LUPA per-visit path if low utilization (SN-weighted illustrative) */
  lupaPerVisitEstimate: number | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

/** Mid-band relative case-mix weights by clinical group family (illustrative PDGM structure). */
export const FAMILY_BASE_WEIGHT: Record<string, number> = {
  MMTA: 1.02,
  NEURO: 1.14,
  WOUND: 1.18,
  COMPLEX: 1.32,
  MS_REHAB: 1.1,
  BEHAVIORAL: 0.96,
  DEFAULT: 1.0,
};

/**
 * Sparse public-style HIPPS weight anchors (illustrative mid-range).
 * Expand as full CMS weight files are loaded. Unknown HIPPS → signal model.
 */
export const HIPPS_WEIGHT_HINTS: Record<string, number> = {
  // Sparse public-style anchors only — not a complete CMS weight file.
  // Prefer signal model when HIPPS is unknown or not listed.
  "1AA11": 0.92,
  "1AB11": 0.96,
  "1AF11": 1.05,
  "1BA11": 0.98,
  "1BF21": 1.12,
  "2AA11": 0.95,
  "2AF11": 1.08,
  "2BF21": 1.18,
  "2CF21": 1.22,
  "3AF11": 1.1,
  "3BF21": 1.2,
  "3CF31": 1.28,
  "4AF11": 1.15,
  "4BF21": 1.25,
  "4CF31": 1.32,
  "4DF41": 1.35,
  "5AF11": 1.08,
  "5BF21": 1.16,
  "5CF31": 1.24,
};

const COMORBIDITY_FACTOR: Record<ComorbidityBand, number> = {
  NONE: 1.0,
  LOW: 1.06,
  HIGH: 1.14,
  UNKNOWN: 1.02,
};

const FUNCTIONAL_FACTOR: Record<FunctionalBand, number> = {
  LOW: 0.94,
  MEDIUM: 1.0,
  HIGH: 1.1,
  UNKNOWN: 1.0,
};

const TIMING_FACTOR: Record<TimingBand, number> = {
  EARLY: 1.03,
  LATE: 0.97,
  UNKNOWN: 1.0,
};

const ADMISSION_FACTOR: Record<AdmissionSource, number> = {
  COMMUNITY: 1.0,
  INSTITUTIONAL: 1.05,
  UNKNOWN: 1.0,
};

function clampWeight(w: number): number {
  return Math.max(0.55, Math.min(2.8, Math.round(w * 1000) / 1000));
}

export function wageIndexFromEnv(): number {
  const n = Number(process.env.AGENCY_WAGE_INDEX ?? 1);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(0.5, Math.min(2.0, n));
}

/** Resolve wage index: explicit arg → env → 1.0 */
export function resolveWageIndex(override?: number | null): number {
  if (override != null && Number.isFinite(override) && override > 0) {
    return Math.max(0.5, Math.min(2.0, override));
  }
  return wageIndexFromEnv();
}

export function inferComorbidityBand(text: string): ComorbidityBand {
  const t = text.toLowerCase();
  const highMarkers =
    (t.match(
      /chf|heart failure|copd|ckd|esrd|diabetes|sepsis|pressure ulcer|stage [34]|malnutrition|oxygen|trach|iv antibiotic/gi,
    ) ?? []).length;
  const secondaryDx =
    (t.match(/m1023|secondary diagnosis|other diagnosis|comorbid/gi) ?? []).length;
  if (highMarkers >= 4 || /high comorbidity|interaction comorbidity/i.test(t)) return "HIGH";
  if (highMarkers >= 2 || secondaryDx >= 2) return "LOW";
  if (/no secondary|comorbidity.?none|m1023.*blank/i.test(t)) return "NONE";
  if (highMarkers === 0 && secondaryDx === 0) return "UNKNOWN";
  return "LOW";
}

export function inferFunctionalBand(text: string): FunctionalBand {
  const t = text;
  // OASIS M1800–M1860 style scores: higher = more dependent
  const m = [
    ...t.matchAll(/\bM18[0-6]0\b[^\d]{0,12}([0-6])\b/gi),
    ...t.matchAll(/\bGG0170[A-Z]\b[^\d]{0,8}0?([1-6])\b/gi),
  ];
  const scores = m.map((x) => Number(x[1])).filter((n) => Number.isFinite(n));
  if (scores.length >= 3) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg >= 3.2) return "HIGH";
    if (avg <= 1.5) return "LOW";
    return "MEDIUM";
  }
  if (/bedbound|total assist|dependent|wheelchair|walks only with supervision/i.test(t)) {
    return "HIGH";
  }
  if (/independent|ambulates independently|minimal assist/i.test(t)) return "LOW";
  return "UNKNOWN";
}

export function inferTiming(text: string): TimingBand {
  if (/\bearly\b|timing:\s*early|pdgm timing:\s*early/i.test(text)) return "EARLY";
  if (/\blate\b|timing:\s*late|pdgm timing:\s*late/i.test(text)) return "LATE";
  // First 30 days of cert often early
  if (/soc date|start of care|first period|period 1/i.test(text) && !/recert|second period/i.test(text)) {
    return "EARLY";
  }
  if (/recert|second 30|period 2|late period/i.test(text)) return "LATE";
  return "UNKNOWN";
}

export function inferAdmissionSource(text: string): AdmissionSource {
  if (/admission source:\s*community|community admission|from community/i.test(text)) {
    return "COMMUNITY";
  }
  if (
    /admission source:\s*institution|institutional|from hospital|post-acute|snf|inpatient/i.test(
      text,
    )
  ) {
    return "INSTITUTIONAL";
  }
  if (/m1000|inpatient facilities\s+na|no inpatient stay/i.test(text)) return "COMMUNITY";
  if (/discharged from|hospitalization within|acute care/i.test(text)) return "INSTITUTIONAL";
  return "UNKNOWN";
}

function signalCaseMixWeight(params: {
  family: string;
  comorbidity: ComorbidityBand;
  functional: FunctionalBand;
  timing: TimingBand;
  admission: AdmissionSource;
}): number {
  const base = FAMILY_BASE_WEIGHT[params.family] ?? FAMILY_BASE_WEIGHT.DEFAULT;
  const w =
    base *
    COMORBIDITY_FACTOR[params.comorbidity] *
    FUNCTIONAL_FACTOR[params.functional] *
    TIMING_FACTOR[params.timing] *
    ADMISSION_FACTOR[params.admission];
  return clampWeight(w);
}

/**
 * Estimate expected full 30-day period payment for this chart.
 * @param wageIndexOverride Agency CBSA wage index when known (else env / 1.0)
 */
export function estimatePeriodPayment(
  text: string,
  wageIndexOverride?: number | null,
): PaymentEstimate {
  const nationalBase = CMS_NATIONAL_30_DAY_PERIOD_PAYMENT;
  const wageIndex = resolveWageIndex(wageIndexOverride);
  const family = inferClinicalGroupFamily(text);
  const comorbidityBand = inferComorbidityBand(text);
  const functionalBand = inferFunctionalBand(text);
  const timing = inferTiming(text);
  const admissionSource = inferAdmissionSource(text);
  const hippsHint = extractHippsHint(text);

  let caseMixWeight: number;
  let method: PaymentEstimate["method"];
  let confidence: PaymentEstimate["confidence"];

  if (hippsHint && HIPPS_WEIGHT_HINTS[hippsHint]) {
    caseMixWeight = clampWeight(HIPPS_WEIGHT_HINTS[hippsHint]);
    method = "hipps_table";
    confidence = "HIGH";
  } else {
    caseMixWeight = signalCaseMixWeight({
      family,
      comorbidity: comorbidityBand,
      functional: functionalBand,
      timing,
      admission: admissionSource,
    });
    method = hippsHint ? "signal_model" : "signal_model";
    // More known signals → higher confidence
    const known = [
      comorbidityBand !== "UNKNOWN",
      functionalBand !== "UNKNOWN",
      timing !== "UNKNOWN",
      admissionSource !== "UNKNOWN",
      family !== "DEFAULT",
    ].filter(Boolean).length;
    confidence = known >= 4 ? "HIGH" : known >= 2 ? "MEDIUM" : "LOW";
    if (hippsHint && !HIPPS_WEIGHT_HINTS[hippsHint]) {
      confidence = confidence === "HIGH" ? "MEDIUM" : confidence;
    }
  }

  const expectedPeriodPayment = Math.round(nationalBase * caseMixWeight * wageIndex * 100) / 100;

  const lupaPerVisitEstimate = Math.round(
    5 * CMS_PER_VISIT_RATES_2026.skilledNursing * wageIndex * 100,
  ) / 100;

  if (hippsHint && HIPPS_WEIGHT_HINTS[hippsHint]) {
    method = "hipps_table";
  } else if (
    family === "DEFAULT" &&
    knownSignalsLow(comorbidityBand, functionalBand, timing, admissionSource)
  ) {
    method = "national_only";
  } else {
    method = "signal_model";
  }

  const basisParts = [
    `CMS CY ${CMS_PAYMENT_YEAR} national base $${nationalBase.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `case-mix weight ${caseMixWeight.toFixed(3)} (${method === "hipps_table" ? `HIPPS ${hippsHint}` : `group ${family}`})`,
    `wage index ${wageIndex.toFixed(3)}${wageIndex === 1 ? " (national default)" : ""}`,
    `comorbidity ${comorbidityBand.toLowerCase()}`,
    `function ${functionalBand.toLowerCase()}`,
    `timing ${timing.toLowerCase()}`,
    `admission ${admissionSource.toLowerCase()}`,
  ];

  return {
    expectedPeriodPayment,
    nationalBase,
    paymentYear: CMS_PAYMENT_YEAR,
    caseMixWeight,
    wageIndex,
    clinicalGroupFamily: family,
    comorbidityBand,
    functionalBand,
    timing,
    admissionSource,
    hippsHint,
    method,
    basis: basisParts.join(" · "),
    lupaPerVisitEstimate,
    confidence,
  };
}

function knownSignalsLow(
  c: ComorbidityBand,
  f: FunctionalBand,
  t: TimingBand,
  a: AdmissionSource,
): boolean {
  return [c, f, t, a].filter((x) => x === "UNKNOWN").length >= 3;
}

/** Scale a national-base dollar amount to this chart's expected period. */
export function scaleToExpectedPeriod(
  nationalDollars: number,
  expectedPeriodPayment: number,
): number {
  if (nationalDollars <= 0) return 0;
  const scale = expectedPeriodPayment / CMS_NATIONAL_30_DAY_PERIOD_PAYMENT;
  return Math.round(Math.min(expectedPeriodPayment, nationalDollars * scale));
}
