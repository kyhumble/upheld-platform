/**
 * Multi-pass Free Chart Scan analyzer.
 *
 * Pass 1 — Clinical Integrity
 * Pass 2 — Compliance Intelligence
 * Pass 3 — Revenue Intelligence
 *
 * Deterministic + knowledge-anchored for MVP reliability and low inference cost.
 * Optional LLM enrichment can wrap this later without changing report shape.
 */

import { CMS_REFS, REVENUE_DEFAULTS } from "./knowledge";
import {
  classifyDocumentText,
  extractClinicianHint,
  extractPatientLabel,
  extractPeriodHint,
} from "./classify";
import {
  estimatePeriodPayment,
  scaleToExpectedPeriod,
  type PaymentEstimate,
} from "./pdgm-payment";
import {
  buildCategoryStats,
  buildExecutiveSummary,
  computeScores,
  countBySeverity,
  sortFindings,
  sumRevenueAtRisk,
  sumRevenueUpside,
} from "./scoring";
import type {
  AnalysisFinding,
  AnalysisResult,
  DocumentType,
  PaymentEstimateSummary,
} from "./types";
import { ANALYZER_VERSION } from "./types";

function toPaymentSummary(p: PaymentEstimate): PaymentEstimateSummary {
  return {
    expectedPeriodPayment: p.expectedPeriodPayment,
    nationalBase: p.nationalBase,
    paymentYear: p.paymentYear,
    caseMixWeight: p.caseMixWeight,
    wageIndex: p.wageIndex,
    clinicalGroupFamily: p.clinicalGroupFamily,
    comorbidityBand: p.comorbidityBand,
    functionalBand: p.functionalBand,
    timing: p.timing,
    admissionSource: p.admissionSource,
    hippsHint: p.hippsHint,
    method: p.method,
    basis: p.basis,
    confidence: p.confidence,
    lupaPerVisitEstimate: p.lupaPerVisitEstimate,
  };
}

/** Scale finding $ from national defaults to this chart's expected period. */
function scaleFindingsToPeriod(
  findings: AnalysisFinding[],
  expectedPeriod: number,
): AnalysisFinding[] {
  return findings.map((f) => {
    if (f.estimatedImpact == null || f.estimatedImpact <= 0) return f;
    return {
      ...f,
      estimatedImpact: scaleToExpectedPeriod(f.estimatedImpact, expectedPeriod),
    };
  });
}

function excerpt(text: string, re: RegExp, max = 180): string | null {
  const m = text.match(re);
  if (!m) return null;
  const idx = m.index ?? 0;
  const start = Math.max(0, idx - 40);
  const slice = text.slice(start, start + max).replace(/\s+/g, " ").trim();
  return slice.length > 0 ? slice : null;
}

function has(text: string, re: RegExp): boolean {
  return re.test(text);
}

function missing(text: string, positive: RegExp, negativeHints?: RegExp): boolean {
  if (negativeHints?.test(text)) return true;
  return !positive.test(text);
}

function passClinical(text: string): AnalysisFinding[] {
  const out: AnalysisFinding[] = [];
  const lower = text;

  if (
    has(lower, /m1306|pressure ulcer|stage\s*[2-4]|wound/i) &&
    missing(lower, /progress(ion|ing)|improving|deteriorat|unchanged|weekly measurement/i)
  ) {
    out.push({
      module: "CLINICAL",
      category: "Wound progression",
      severity: "HIGH",
      title: "Wound progression not documented across visits",
      description:
        "Wound or pressure injury is present, but the chart lacks a clear progression statement " +
        "(improving / unchanged / declining) and consistent serial measurements after SOC.",
      suggestedCorrection:
        "Add weekly measurements (L×W×D), tissue type, drainage, and a progression statement. " +
        "Document physician notification if decline or stalled healing.",
      cmsReference: CMS_REFS.WOUND,
      estimatedImpact: REVENUE_DEFAULTS.woundSkilledNeed,
      impactType: "EXPOSURE",
      evidenceExcerpt: excerpt(lower, /wound|pressure ulcer|m1306|stage\s*[2-4]/i),
    });
  }

  if (
    has(lower, /m1860|ambulation|gait|walker|transfer/i) &&
    missing(lower, /gg0170|functional.*score|baseline.*gg/i) &&
    !has(lower, /gg0170/i)
  ) {
    out.push({
      module: "CLINICAL",
      category: "Functional assessment",
      severity: "MEDIUM",
      title: "Functional / GG documentation incomplete relative to mobility narrative",
      description:
        "Mobility limitations are described, but GG functional items appear incomplete or absent, " +
        "weakening functional level support for PDGM.",
      suggestedCorrection:
        "Complete GG0130/GG0170 items consistent with narrative ambulation and transfer ability. " +
        "Align M1800–M1860 with GG responses.",
      cmsReference: CMS_REFS.OASIS,
      estimatedImpact: REVENUE_DEFAULTS.functionalDoc,
      impactType: "EXPOSURE",
      evidenceExcerpt: excerpt(lower, /ambulation|walker|m1860|gait/i),
    });
  }

  if (
    has(lower, /edema|weight|chf|heart failure|i50/i) &&
    missing(lower, /weight compared|weight trend|baseline weight|daily weight/i)
  ) {
    out.push({
      module: "CLINICAL",
      category: "Assessment quality",
      severity: "MEDIUM",
      title: "Cardiac / fluid status reassessment gaps",
      description:
        "CHF or edema is present in the chart without documented weight trends or comparison " +
        "to prior visits when symptoms change.",
      suggestedCorrection:
        "Document weights with comparison to prior visit, edema grade, and any POC frequency change " +
        "when fluid status worsens.",
      cmsReference: CMS_REFS.PLAN_OF_CARE,
      estimatedImpact: REVENUE_DEFAULTS.clinicalReassess,
      impactType: "EXPOSURE",
      evidenceExcerpt: excerpt(lower, /edema|heart failure|chf|i50/i),
    });
  }

  if (
    has(lower, /m1021|primary diagnosis/i) &&
    has(lower, /unspecified|i50\.9|e11\.9/i)
  ) {
    out.push({
      module: "CLINICAL",
      category: "Diagnosis specificity",
      severity: "HIGH",
      title: "Primary or secondary diagnoses lack clinical specificity",
      description:
        "Unspecified codes (e.g., heart failure unspecified, diabetes without complications) appear " +
        "while the narrative supports more specific clinical detail.",
      suggestedCorrection:
        "Query clinician for acuity/type (e.g., acute on chronic systolic HF) and diabetes with " +
        "complications supported by documentation (neuropathy, ulcer).",
      cmsReference: CMS_REFS.PDGM,
      estimatedImpact: REVENUE_DEFAULTS.caseMixUnderCode,
      impactType: "RECOVERY",
      evidenceExcerpt: excerpt(lower, /m1021|i50\.9|e11\.9|unspecified/i),
    });
  }

  if (
    has(lower, /visit|skilled nursing|sn /i) &&
    missing(lower, /skilled need|medical necessity narrative|intermittent|homebound criteria/i)
  ) {
    out.push({
      module: "CLINICAL",
      category: "Skilled need",
      severity: "MEDIUM",
      title: "Skilled need rationale is thin across visit notes",
      description:
        "Visit notes describe tasks performed but under-document why skilled intermittent care " +
        "remains necessary versus custodial care.",
      suggestedCorrection:
        "Each SN/PT note should restate skilled interventions, patient response, and ongoing " +
        "need tied to goals on the plan of care.",
      cmsReference: CMS_REFS.PLAN_OF_CARE,
      estimatedImpact: REVENUE_DEFAULTS.skilledNeedDoc,
      impactType: "EXPOSURE",
      evidenceExcerpt: excerpt(lower, /visit|skilled nursing|continue poc/i),
    });
  }

  // OASIS consistency: M1860 high dependence vs independent GG ambulation language
  const m1860 = lower.match(/m1860[^\n]{0,80}([0-6])/i);
  const m1860Val = m1860 ? Number(m1860[1]) : null;
  if (
    m1860Val != null &&
    m1860Val >= 3 &&
    has(lower, /gg0170i[^\n]{0,40}(06|independent)|walks independently|ambulates independently/i)
  ) {
    out.push({
      module: "CLINICAL",
      category: "OASIS consistency",
      severity: "HIGH",
      title: "OASIS M1860 / GG ambulation responses appear inconsistent",
      description:
        `M1860 suggests substantial ambulation dependence (value ${m1860Val}) while GG or narrative ` +
        "language indicates independence — a common survey and case-mix integrity flag.",
      suggestedCorrection:
        "Reconcile M1860 with GG0170I/J and narrative. Align functional scores to observed performance " +
        "at the assessment timepoint; document clinical rationale if residual differences remain.",
      cmsReference: CMS_REFS.OASIS,
      estimatedImpact: REVENUE_DEFAULTS.functionalDoc,
      impactType: "EXPOSURE",
      evidenceExcerpt: excerpt(lower, /m1860|gg0170i|ambulat/i),
    });
  }

  // Missing M1021 when OASIS packet present
  if (has(lower, /oasis|m0030|start of care/i) && missing(lower, /m1021/i)) {
    out.push({
      module: "CLINICAL",
      category: "OASIS consistency",
      severity: "CRITICAL",
      title: "Primary diagnosis (M1021) not found in OASIS packet",
      description:
        "OASIS content is present but M1021 primary diagnosis is missing — PDGM clinical grouping " +
        "cannot be defended without a coded primary diagnosis.",
      suggestedCorrection:
        "Complete M1021 with the principal diagnosis supported by the comprehensive assessment " +
        "and physician orders.",
      cmsReference: CMS_REFS.OASIS,
      estimatedImpact: REVENUE_DEFAULTS.caseMixUnderCode,
      impactType: "RECOVERY",
      evidenceExcerpt: excerpt(lower, /oasis|start of care|m0030/i),
    });
  }

  // M1800–M1860 block incomplete when GG present
  if (
    has(lower, /gg0170|gg0130/i) &&
    missing(lower, /m1860/i) &&
    has(lower, /oasis/i)
  ) {
    out.push({
      module: "CLINICAL",
      category: "OASIS consistency",
      severity: "MEDIUM",
      title: "ADL / ambulation OASIS items incomplete relative to GG",
      description:
        "GG functional items are present but M1860 (or related ADL items) appear missing from the packet, " +
        "weakening cross-walk for functional impairment level.",
      suggestedCorrection:
        "Ensure M1800–M1860 are complete and directionally consistent with GG0130/GG0170 responses.",
      cmsReference: CMS_REFS.OASIS,
      estimatedImpact: REVENUE_DEFAULTS.functionalDoc,
      impactType: "EXPOSURE",
      evidenceExcerpt: excerpt(lower, /gg0170|gg0130/i),
    });
  }

  return out;
}

function passCompliance(text: string): AnalysisFinding[] {
  const out: AnalysisFinding[] = [];

  if (
    missing(text, /face[- ]?to[- ]?face|f2f encounter|encounter date/i) ||
    has(text, /f2f documentation:\s*not found|face-to-face.*not found/i)
  ) {
    out.push({
      module: "COMPLIANCE",
      category: "Face-to-face",
      severity: "CRITICAL",
      title: "Face-to-face encounter documentation missing or incomplete",
      description:
        "Medicare home health requires a qualifying face-to-face encounter related to the primary " +
        "reason for home health, with date and clinical content supporting home care need.",
      suggestedCorrection:
        "Obtain F2F encounter note (or addendum) with date, practitioner, findings related to " +
        "home health need, and signature before claim submission.",
      cmsReference: CMS_REFS.F2F,
      estimatedImpact: REVENUE_DEFAULTS.f2fDenial,
      impactType: "EXPOSURE",
      evidenceExcerpt: excerpt(text, /f2f|face[- ]?to[- ]?face|pcp saw/i) ??
        "No F2F section with encounter date found in packet.",
    });
  }

  if (
    missing(text, /considerable and taxing|criteria\s*1|criteria\s*2|normal inability to leave/i) ||
    has(text, /no criteria 1|homebound.*not documented|no statement that leaving home/i)
  ) {
    out.push({
      module: "COMPLIANCE",
      category: "Homebound",
      severity: "CRITICAL",
      title: "Homebound status not structured to CoP / Medicare criteria",
      description:
        "Narrative mentions limited mobility but does not document Criteria 1 and Criteria 2 " +
        "(or equivalent structured homebound justification).",
      suggestedCorrection:
        "Document (1) assistance/device/special transportation need and (2) considerable and taxing " +
        "effort, with clinical support. Align SOC and ongoing notes.",
      cmsReference: CMS_REFS.HOMEBOUND,
      estimatedImpact: REVENUE_DEFAULTS.homeboundDenial,
      impactType: "EXPOSURE",
      evidenceExcerpt: excerpt(text, /homebound|tires with ambulation|walker/i),
    });
  }

  if (
    has(text, /certification|physician certification/i) &&
    (has(text, /homebound checkbox blank|estimated length of service blank|partial/i) ||
      missing(text, /certification complete|fully certified|all certification elements/i))
  ) {
    out.push({
      module: "COMPLIANCE",
      category: "Certification",
      severity: "HIGH",
      title: "Physician certification elements incomplete",
      description:
        "Certification appears partial (e.g., homebound or estimated length of service not completed).",
      suggestedCorrection:
        "Complete all certification elements: need for skilled services, homebound, plan of care " +
        "establishment/review, and timing within regulatory windows.",
      cmsReference: CMS_REFS.CERTIFICATION,
      estimatedImpact: REVENUE_DEFAULTS.certGap,
      impactType: "EXPOSURE",
      evidenceExcerpt: excerpt(text, /certification|homebound checkbox|estimated length/i),
    });
  }

  if (
    has(text, /order|plan of care/i) &&
    missing(text, /signed by|electronic signature|physician signature/i)
  ) {
    out.push({
      module: "COMPLIANCE",
      category: "Orders & signatures",
      severity: "HIGH",
      title: "Physician order signature not clearly evidenced",
      description:
        "Plan of care / orders section lacks a clear practitioner signature trail in the packet.",
      suggestedCorrection:
        "Ensure signed orders (wet or compliant electronic) are in the legal medical record " +
        "before billing the period.",
      cmsReference: CMS_REFS.SIGNATURES,
      estimatedImpact: REVENUE_DEFAULTS.orderSignature,
      impactType: "EXPOSURE",
      evidenceExcerpt: excerpt(text, /orders dated|plan of care|frequency/i),
    });
  }

  if (has(text, /recertification orders:\s*not present|recert.*missing/i)) {
    out.push({
      module: "COMPLIANCE",
      category: "Certification",
      severity: "MEDIUM",
      title: "Recertification orders not present in packet",
      description:
        "If the episode will continue beyond the initial certification period, recertification " +
        "orders and assessment timing must be present.",
      suggestedCorrection:
        "If continuing care past day 60, schedule recert OASIS and obtain updated signed orders " +
        "before the period lapses.",
      cmsReference: CMS_REFS.CERTIFICATION,
      estimatedImpact: REVENUE_DEFAULTS.recertDoc,
      impactType: "EXPOSURE",
      evidenceExcerpt: excerpt(text, /recertification/i),
    });
  }

  return out;
}

function passRevenue(text: string): AnalysisFinding[] {
  const out: AnalysisFinding[] = [];

  // LUPA risk from visit counts
  const completed = text.match(/visits completed[^\d]{0,20}(\d+)/i);
  const scheduled = text.match(/visits scheduled[^\d]{0,40}(\d+)/i);
  const c = completed ? Number(completed[1]) : null;
  const s = scheduled ? Number(scheduled[1]) : null;
  if ((c !== null && c <= 5) || (s !== null && s <= 5) || has(text, /borderline|lupa/i)) {
    out.push({
      module: "REVENUE",
      category: "LUPA risk",
      severity: "CRITICAL",
      title: "LUPA threshold risk — low skilled visit volume for period",
      description:
        `Skilled visit volume appears low` +
        (c !== null ? ` (${c} completed` : "") +
        (s !== null ? `${c !== null ? ", " : " ("}${s} scheduled)` : c !== null ? ")" : "") +
        `. If total skilled visits stay at or below the HIPPS-specific LUPA threshold, ` +
        `payment drops from full PDGM period payment to per-visit LUPA rates.`,
      suggestedCorrection:
        "Validate HIPPS LUPA threshold for this case-mix group. If clinically appropriate, " +
        "adjust schedule before period end; document missed visits and medical necessity.",
      cmsReference: CMS_REFS.LUPA,
      estimatedImpact: REVENUE_DEFAULTS.lupaFullPeriodGap,
      impactType: "EXPOSURE",
      evidenceExcerpt: excerpt(text, /visits completed|visits scheduled|lupa|borderline/i),
    });
  }

  if (
    has(text, /ckd|a-?fib|atrial fib|neuropathy|n18|i48/i) &&
    (has(text, /do not capture|m1023.*blank|secondary diagnoses do not/i) ||
      (has(text, /ckd|a-?fib|neuropathy/i) && missing(text, /m1023b:\s*[a-z]/i)))
  ) {
    out.push({
      module: "REVENUE",
      category: "Comorbidity capture",
      severity: "HIGH",
      title: "Secondary diagnoses in narrative not coded on OASIS",
      description:
        "Clinical narrative references comorbidities (e.g., CKD, A-fib, neuropathy) that are " +
        "not reflected in M1023 secondary diagnosis slots — potential missed comorbidity adjustment.",
      suggestedCorrection:
        "Code all documented, relevant secondary diagnoses supported by the record. " +
        "Confirm interaction with PDGM comorbidity subgroups.",
      cmsReference: CMS_REFS.COMORBIDITY,
      estimatedImpact: REVENUE_DEFAULTS.comorbidityMiss,
      impactType: "RECOVERY",
      evidenceExcerpt: excerpt(text, /ckd|a-?fib|neuropathy|comorbidity|m1023/i),
    });
  }

  if (
    has(text, /noa|notice of admission/i) &&
    (has(text, /day\s*7|outside.*5-day|late noa/i) || missing(text, /within 5 days|day\s*[1-5]\b/i))
  ) {
    out.push({
      module: "REVENUE",
      category: "NOA timing",
      severity: "HIGH",
      title: "Notice of Admission outside 5-day window",
      description:
        "NOA appears submitted beyond the preferred 5-day window from SOC, creating payment " +
        "reduction risk for late NOA.",
      suggestedCorrection:
        "Operationalize same-day/next-day NOA at SOC. For this episode, document reason for delay " +
        "and confirm claim adjustments if late NOA penalty applies.",
      cmsReference: CMS_REFS.NOA,
      estimatedImpact: REVENUE_DEFAULTS.lateNoa,
      impactType: "EXPOSURE",
      evidenceExcerpt: excerpt(text, /noa|notice of admission|day\s*\d/i),
    });
  }

  // Avoid double-counting case-mix $ when diagnosis-specificity already flagged in clinical pass
  if (
    has(text, /unspecified|i50\.9|without complications/i) &&
    !has(text, /m1021|primary diagnosis/i)
  ) {
    out.push({
      module: "REVENUE",
      category: "Case-mix / coding",
      severity: "HIGH",
      title: "Undercoding indicators — case-mix may be understated",
      description:
        "Unspecified primary/secondary coding plus richer narrative detail suggests the period " +
        "may group to a lower clinical category or comorbidity tier than documentation supports.",
      suggestedCorrection:
        "Run coding review against full narrative and wound/cardiac detail before final claim. " +
        "Only code diagnoses supported by the clinical record.",
      cmsReference: CMS_REFS.PDGM,
      estimatedImpact: REVENUE_DEFAULTS.caseMixUnderCode,
      impactType: "RECOVERY",
      evidenceExcerpt: excerpt(text, /m1021|unspecified|primary diagnosis/i),
    });
  }

  if (has(text, /medicare|pdgm/i) && missing(text, /hipps|clinical group|functional level/i)) {
    out.push({
      module: "REVENUE",
      category: "PDGM readiness",
      severity: "LOW",
      title: "No explicit PDGM grouping snapshot in packet",
      description:
        "Packet does not include an internal HIPPS / clinical group / functional level snapshot " +
        "for pre-bill validation (optional but useful for revenue integrity).",
      suggestedCorrection:
        "Attach internal grouping preview to QA checklist before RAP/final claim.",
      cmsReference: CMS_REFS.PDGM,
      estimatedImpact: 0,
      impactType: "NEUTRAL",
      evidenceExcerpt: null,
    });
  }

  return out;
}

function detectDocumentTypes(fileName: string, text: string): DocumentType[] {
  const primary = classifyDocumentText(fileName, text);
  const types = new Set<DocumentType>([primary]);
  if (/oasis|m00\d{2}/i.test(text)) types.add("OASIS");
  if (/order|plan of care/i.test(text)) types.add("ORDERS");
  if (/visit/i.test(text)) types.add("VISIT_NOTE");
  if (/wound|pressure/i.test(text)) types.add("WOUND");
  if (/f2f|face[- ]?to[- ]?face/i.test(text)) types.add("F2F");
  if (/certification/i.test(text)) types.add("CERTIFICATION");
  types.delete("UNKNOWN");
  if (types.size === 0) types.add("OTHER");
  return [...types];
}

/** Deduplicate near-identical titles */
function dedupe(findings: AnalysisFinding[]): AnalysisFinding[] {
  const seen = new Set<string>();
  const out: AnalysisFinding[] = [];
  for (const f of findings) {
    const key = `${f.module}:${f.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export function analyzeChartText(params: {
  text: string;
  fileName?: string;
  wageIndex?: number | null;
}): AnalysisResult {
  const text = params.text?.trim() ?? "";
  const fileName = params.fileName ?? "episode.txt";
  const wageIdx = params.wageIndex;

  if (text.length < 40) {
    const findings: AnalysisFinding[] = [
      {
        module: "CLINICAL",
        category: "Ingestion",
        severity: "CRITICAL",
        title: "Insufficient chart text to analyze",
        description:
          "Extracted content is too short for a reliable multi-pass review. " +
          "PDF OCR may have failed, or the upload was empty.",
        suggestedCorrection:
          "Re-upload a clearer PDF, a ZIP of documents, or paste episode text. " +
          "Prefer complete SOC OASIS + orders + visit notes.",
        cmsReference: null,
        estimatedImpact: null,
        impactType: "NEUTRAL",
        evidenceExcerpt: text.slice(0, 120) || null,
      },
    ];
    // Empty modules would default to high scores — force low readiness for unusable packets.
    const scores = {
      clinical: 20,
      compliance: 20,
      revenue: 20,
      readiness: 20,
    };
    const severityCounts = countBySeverity(findings);
    const paymentEstimate = toPaymentSummary(estimatePeriodPayment(text || " ", wageIdx));
    return {
      findings,
      scores,
      revenueAtRisk: 0,
      revenueUpside: 0,
      expectedPeriodPayment: paymentEstimate.expectedPeriodPayment,
      paymentEstimate,
      severityCounts,
      categoryStats: buildCategoryStats(findings),
      executiveSummary: buildExecutiveSummary({
        readiness: scores.readiness,
        revenueAtRisk: 0,
        revenueUpside: 0,
        expectedPeriodPayment: paymentEstimate.expectedPeriodPayment,
        paymentBasis: paymentEstimate.basis,
        counts: severityCounts,
        topTitles: findings.map((f) => f.title),
      }),
      documentTypesDetected: ["UNKNOWN"],
      patientLabelHint: null,
      clinicianHint: null,
      periodHint: null,
      analyzerVersion: ANALYZER_VERSION,
    };
  }

  const payment = estimatePeriodPayment(text, wageIdx);
  const paymentEstimate = toPaymentSummary(payment);
  const periodCap = payment.expectedPeriodPayment;

  const raw = [
    ...passClinical(text),
    ...passCompliance(text),
    ...passRevenue(text),
  ];
  const findings = scaleFindingsToPeriod(sortFindings(dedupe(raw)), periodCap);
  const scores = computeScores(findings);
  const revenueAtRisk = sumRevenueAtRisk(findings, periodCap);
  const revenueUpside = sumRevenueUpside(findings, periodCap);
  const severityCounts = countBySeverity(findings);
  const categoryStats = buildCategoryStats(findings);

  return {
    findings,
    scores,
    revenueAtRisk,
    revenueUpside,
    expectedPeriodPayment: periodCap,
    paymentEstimate,
    severityCounts,
    categoryStats,
    executiveSummary: buildExecutiveSummary({
      readiness: scores.readiness,
      revenueAtRisk,
      revenueUpside,
      expectedPeriodPayment: periodCap,
      paymentBasis: payment.basis,
      counts: severityCounts,
      topTitles: findings
        .filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH")
        .map((f) => f.title),
    }),
    documentTypesDetected: detectDocumentTypes(fileName, text),
    patientLabelHint: extractPatientLabel(text),
    clinicianHint: extractClinicianHint(text),
    periodHint: extractPeriodHint(text),
    analyzerVersion: ANALYZER_VERSION,
  };
}
