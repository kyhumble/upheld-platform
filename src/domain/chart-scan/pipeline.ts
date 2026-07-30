/**
 * Free Chart Scan orchestration:
 * 1) Deterministic multi-pass analysis
 * 2) LUPA structured assessment (inject/replace revenue finding)
 * 3) Optional LLM enrichment
 */

import { analyzeChartText } from "./analyzer";
import { assessLupaRisk } from "./lupa";
import { enrichWithLlm } from "./llm-enrich";
import { CMS_REFS } from "./knowledge";
import { estimatePeriodPayment } from "./pdgm-payment";
import {
  buildCategoryStats,
  buildExecutiveSummary,
  computeScores,
  countBySeverity,
  sortFindings,
  sumRevenueAtRisk,
  sumRevenueUpside,
} from "./scoring";
import type { AnalysisFinding, AnalysisResult, PaymentEstimateSummary } from "./types";
import { ANALYZER_VERSION } from "./types";

export type PipelineMeta = {
  lupa: ReturnType<typeof assessLupaRisk>;
  llm: {
    used: boolean;
    provider: string;
    model: string;
    latencyMs: number;
    error?: string;
    addedFindings: number;
  };
  analyzerVersion: string;
  payment?: PaymentEstimateSummary;
};

export type PipelineResult = AnalysisResult & { meta: PipelineMeta };

function applyLupaFinding(
  findings: AnalysisFinding[],
  text: string,
): { findings: AnalysisFinding[]; lupa: ReturnType<typeof assessLupaRisk> } {
  const lupa = assessLupaRisk(text);
  const withoutOldLupa = findings.filter(
    (f) => !(f.module === "REVENUE" && /lupa/i.test(f.category + f.title)),
  );

  if (lupa.risk === "NONE" || lupa.risk === "UNKNOWN") {
    // Keep unknown silent unless chart already had a LUPA signal from analyzer
    if (lupa.risk === "UNKNOWN" && lupa.estimatedPaymentGap === 0) {
      return { findings: withoutOldLupa, lupa };
    }
    if (lupa.risk === "NONE") {
      return { findings: withoutOldLupa, lupa };
    }
  }

  const severity =
    lupa.risk === "LIKELY_LUPA" ? "CRITICAL" : lupa.risk === "BORDERLINE" ? "HIGH" : "MEDIUM";

  // LUPA gap scaled later to chart expected period in recompute
  const lupaFinding: AnalysisFinding = {
    module: "REVENUE",
    category: "LUPA risk",
    severity,
    title:
      lupa.risk === "LIKELY_LUPA"
        ? "LUPA threshold risk — low skilled visit volume for period"
        : "Borderline LUPA exposure — visit schedule at risk",
    description: lupa.detail,
    suggestedCorrection:
      "Validate HIPPS-specific LUPA threshold. If clinically appropriate, add skilled visits before period end; document missed visits and medical necessity. Re-check after schedule change.",
    cmsReference: CMS_REFS.LUPA,
    estimatedImpact: lupa.estimatedPaymentGap,
    impactType: "EXPOSURE",
    evidenceExcerpt:
      lupa.effectiveVisits != null
        ? `Visits~${lupa.effectiveVisits} vs threshold ${lupa.assumedThreshold} (${lupa.clinicalGroupHint})`
        : null,
  };

  return { findings: [...withoutOldLupa, lupaFinding], lupa };
}

function recompute(
  findings: AnalysisFinding[],
  paymentEstimate: PaymentEstimateSummary,
): Omit<
  AnalysisResult,
  "documentTypesDetected" | "patientLabelHint" | "clinicianHint" | "periodHint" | "analyzerVersion"
> {
  const periodCap = paymentEstimate.expectedPeriodPayment;
  // Findings from analyzer are already scaled to period; only re-pin LUPA gap to this chart
  const sorted = sortFindings(findings);
  const withLupaAdjusted = sorted.map((f) => {
    if (f.module !== "REVENUE" || !/lupa/i.test(f.category + f.title)) return f;
    if (paymentEstimate.lupaPerVisitEstimate == null) return f;
    const gap = Math.max(
      0,
      Math.round(periodCap - paymentEstimate.lupaPerVisitEstimate),
    );
    return {
      ...f,
      estimatedImpact: Math.min(periodCap, gap > 0 ? gap : (f.estimatedImpact ?? 0)),
    };
  });

  const scores = computeScores(withLupaAdjusted);
  const revenueAtRisk = sumRevenueAtRisk(withLupaAdjusted, periodCap);
  const revenueUpside = sumRevenueUpside(withLupaAdjusted, periodCap);
  const severityCounts = countBySeverity(withLupaAdjusted);
  const categoryStats = buildCategoryStats(withLupaAdjusted);
  return {
    findings: withLupaAdjusted,
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
      paymentBasis: paymentEstimate.basis,
      counts: severityCounts,
      topTitles: withLupaAdjusted
        .filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH")
        .map((f) => f.title),
    }),
  };
}

export async function runChartScanPipeline(params: {
  text: string;
  fileName?: string;
  enableLlm?: boolean;
  signal?: AbortSignal;
  wageIndex?: number | null;
}): Promise<PipelineResult> {
  const base = analyzeChartText({
    text: params.text,
    fileName: params.fileName,
    wageIndex: params.wageIndex,
  });

  // Unusable packet — keep analyzer readiness (do not recompute empty modules high)
  const insufficient = base.findings.some(
    (f) => f.category === "Ingestion" && /insufficient chart text/i.test(f.title),
  );
  const payment = base.paymentEstimate;

  if (insufficient) {
    const lupa = assessLupaRisk(params.text);
    return {
      ...base,
      analyzerVersion: `${ANALYZER_VERSION}+lupa+pay`,
      meta: {
        lupa,
        llm: {
          used: false,
          provider: "none",
          model: "deterministic-only",
          latencyMs: 0,
          addedFindings: 0,
        },
        analyzerVersion: `${ANALYZER_VERSION}+lupa+pay`,
        payment,
      },
    };
  }

  const { findings: withLupa, lupa } = applyLupaFinding(base.findings, params.text);

  let llmFindings: AnalysisFinding[] = [];
  let llmMeta: PipelineMeta["llm"] = {
    used: false,
    provider: "none",
    model: "deterministic-only",
    latencyMs: 0,
    addedFindings: 0,
  };

  if (params.enableLlm !== false && params.text.trim().length >= 40) {
    const enrich = await enrichWithLlm({
      chartText: params.text,
      existingFindings: withLupa,
      signal: params.signal,
    });
    llmFindings = enrich.findings;
    llmMeta = {
      used: enrich.used,
      provider: enrich.provider,
      model: enrich.model,
      latencyMs: enrich.latencyMs,
      error: enrich.error,
      addedFindings: enrich.findings.length,
    };
  }

  // Prefer fresh estimate from full text (pipeline may have richer LUPA context)
  const freshPay = estimatePeriodPayment(params.text, params.wageIndex);
  const paymentEstimate: PaymentEstimateSummary = {
    expectedPeriodPayment: freshPay.expectedPeriodPayment,
    nationalBase: freshPay.nationalBase,
    paymentYear: freshPay.paymentYear,
    caseMixWeight: freshPay.caseMixWeight,
    wageIndex: freshPay.wageIndex,
    clinicalGroupFamily: freshPay.clinicalGroupFamily,
    comorbidityBand: freshPay.comorbidityBand,
    functionalBand: freshPay.functionalBand,
    timing: freshPay.timing,
    admissionSource: freshPay.admissionSource,
    hippsHint: freshPay.hippsHint,
    method: freshPay.method,
    basis: freshPay.basis,
    confidence: freshPay.confidence,
    lupaPerVisitEstimate: freshPay.lupaPerVisitEstimate,
  };

  const merged = recompute([...withLupa, ...llmFindings], paymentEstimate);

  return {
    ...merged,
    documentTypesDetected: base.documentTypesDetected,
    patientLabelHint: base.patientLabelHint,
    clinicianHint: base.clinicianHint,
    periodHint: base.periodHint,
    analyzerVersion: `${ANALYZER_VERSION}+lupa${llmMeta.used ? "+llm" : ""}+pay`,
    meta: {
      lupa,
      llm: llmMeta,
      analyzerVersion: `${ANALYZER_VERSION}+lupa${llmMeta.used ? "+llm" : ""}+pay`,
      payment: paymentEstimate,
    },
  };
}
