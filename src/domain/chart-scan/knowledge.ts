/**
 * Curated CMS / home-health knowledge anchors used by Free Chart Scan.
 * Rate tables version with HH PPS final rules (do not invent agency averages).
 */

export const CMS_REFS = {
  F2F: "42 CFR §424.22(a)(1)(v) — Face-to-Face Encounter",
  HOMEBOUND: "42 CFR §409.42(a) — Homebound Criteria",
  PLAN_OF_CARE: "42 CFR §484.60 — Care planning, coordination, and quality of care",
  OASIS: "CMS OASIS-E Guidance Manual — Accurate assessment & timing",
  LUPA: "CMS PDGM — Low Utilization Payment Adjustment thresholds",
  CERTIFICATION: "42 CFR §424.22 — Physician certification & recertification",
  SIGNATURES: "42 CFR §484.55 / CoP — Comprehensive assessment & signatures",
  WOUND: "CMS Home Health Claims Processing / wound documentation standards",
  COMORBIDITY: "CMS PDGM Comorbidity Adjustment — secondary diagnoses",
  NOA: "CMS Notice of Admission (NOA) — 5-day submission window",
  PDGM: "CMS Patient-Driven Groupings Model (PDGM) payment logic",
  COP_SURVEY: "42 CFR Part 484 — Conditions of Participation (survey risk)",
  HH_PPS_CY2026:
    "CMS CY 2026 HH PPS Final Rule (CMS-1828-F) — national standardized 30-day period & per-visit rates",
} as const;

/**
 * CMS Calendar Year 2026 Home Health PPS rate anchors.
 * Source: CY 2026 HH PPS Final Rule (CMS-1828-F) / related rate-update materials.
 *
 * National, standardized 30-day period payment (HHAs that submit quality data).
 * Actual claim payment = this rate × case-mix weight × wage index (not applied here).
 * Advisory only — not a CMS grouper or remittance determination.
 */
export const CMS_PAYMENT_YEAR = 2026;

/** CMS national standardized 30-day period payment (quality data submitters). */
export const CMS_NATIONAL_30_DAY_PERIOD_PAYMENT = 2038.22;

/** CMS national standardized 30-day period payment (no quality data / −2 pp update). */
export const CMS_NATIONAL_30_DAY_PERIOD_PAYMENT_NO_QUALITY = 1998.41;

/**
 * CMS CY 2026 national per-visit amounts (quality data submitters).
 * Used for LUPA / outlier-style advisory estimates.
 */
export const CMS_PER_VISIT_RATES_2026 = {
  aide: 80.12,
  medicalSocialServices: 283.64,
  occupationalTherapy: 194.74,
  physicalTherapy: 193.42,
  skilledNursing: 176.96,
  speechLanguagePathology: 210.25,
} as const;

/** Alias used by scoring / caps — always CMS national period base, never a casual average. */
export const TYPICAL_PERIOD_PAYMENT = CMS_NATIONAL_30_DAY_PERIOD_PAYMENT;

/**
 * Illustrative LUPA gap on CMS rates:
 * full period − (default threshold visits × SN per-visit).
 * Threshold mid-band = 5; 5 × $176.96 SN = $884.80 → gap ≈ $1,153.
 */
export const CMS_LUPA_ILLUSTRATIVE_GAP = Math.round(
  CMS_NATIONAL_30_DAY_PERIOD_PAYMENT - 5 * CMS_PER_VISIT_RATES_2026.skilledNursing,
);

function pctOfPeriod(pct: number): number {
  return Math.round(CMS_NATIONAL_30_DAY_PERIOD_PAYMENT * pct);
}

/**
 * Per-finding advisory $ — scaled to CMS national 30-day period ($2,038.22).
 *
 * Denial-class tags share one claim ceiling (max, not sum).
 * Incremental tags (LUPA gap, coding, NOA) use CMS-derived dollars.
 */
export const REVENUE_DEFAULTS = {
  /** ~11% case-mix / specificity undercoding delta */
  caseMixUnderCode: pctOfPeriod(0.11),
  /** ~5% comorbidity adjustment miss */
  comorbidityMiss: pctOfPeriod(0.05),
  /** CMS-illustrative full period vs LUPA per-visit (SN × 5) */
  lupaFullPeriodGap: CMS_LUPA_ILLUSTRATIVE_GAP,
  /** ~45% of period — probability-weighted F2F denial share (not 100% remittance) */
  f2fDenial: pctOfPeriod(0.45),
  /** ~38% — homebound (same claim pool as F2F) */
  homeboundDenial: pctOfPeriod(0.38),
  /** ~6% wound / skilled-need documentation */
  woundSkilledNeed: pctOfPeriod(0.06),
  /**
   * Late NOA non-timely reduction: ~period/30 × days late (illustrative 7 days past window ≈ 2 days over).
   * Uses CMS period / 30 × 2.
   */
  lateNoa: Math.round((CMS_NATIONAL_30_DAY_PERIOD_PAYMENT / 30) * 2),
  /** ~18% orders / signature trail */
  orderSignature: pctOfPeriod(0.18),
  /** ~22% incomplete certification */
  certGap: pctOfPeriod(0.22),
  /** ~4% functional / GG */
  functionalDoc: pctOfPeriod(0.04),
  /** ~3% clinical reassessment */
  clinicalReassess: pctOfPeriod(0.03),
  /** ~4.5% skilled-need narrative */
  skilledNeedDoc: pctOfPeriod(0.045),
  /** ~5% recert packing */
  recertDoc: pctOfPeriod(0.05),
} as const;

/** Categories treated as “one CMS period claim at risk” — only the max counts. */
export const DENIAL_CEILING_CATEGORIES = new Set([
  "Face-to-face",
  "Homebound",
  "Certification",
  "Orders & signatures",
]);
