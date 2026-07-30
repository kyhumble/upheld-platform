export type FindingModule = "CLINICAL" | "COMPLIANCE" | "REVENUE";
export type FindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
/** RECOVERY = dollars you may capture if fixed; EXPOSURE = dollars at risk of loss/denial; NEUTRAL = no $ */
export type ImpactType = "RECOVERY" | "EXPOSURE" | "NEUTRAL";
export type DocumentType =
  | "OASIS"
  | "ORDERS"
  | "VISIT_NOTE"
  | "WOUND"
  | "F2F"
  | "CERTIFICATION"
  | "OTHER"
  | "UNKNOWN";

export type AnalysisFinding = {
  module: FindingModule;
  category: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  suggestedCorrection: string;
  cmsReference: string | null;
  estimatedImpact: number | null;
  /** How the $ should be read on the report */
  impactType: ImpactType;
  evidenceExcerpt: string | null;
};

export type ModuleScores = {
  clinical: number;
  compliance: number;
  revenue: number;
  readiness: number;
};

export type CategoryStat = {
  category: string;
  count: number;
  impact: number;
  recovery: number;
  exposure: number;
};

export type PaymentEstimateSummary = {
  expectedPeriodPayment: number;
  nationalBase: number;
  paymentYear: number;
  caseMixWeight: number;
  wageIndex: number;
  clinicalGroupFamily: string;
  comorbidityBand: string;
  functionalBand: string;
  timing: string;
  admissionSource: string;
  hippsHint: string | null;
  method: string;
  basis: string;
  confidence: string;
  lupaPerVisitEstimate: number | null;
};

export type AnalysisInput = {
  text: string;
  fileName?: string;
  /** Agency wage index for period payment (optional) */
  wageIndex?: number | null;
};

export type AnalysisResult = {
  findings: AnalysisFinding[];
  scores: ModuleScores;
  /** Downside — denial / LUPA / takeback risk if submitted as-is */
  revenueAtRisk: number;
  /** Upside — undercoding / comorbidity / case-mix capture if corrected */
  revenueUpside: number;
  /** Chart-specific expected full 30-day period payment (Phase 2) */
  expectedPeriodPayment: number;
  paymentEstimate: PaymentEstimateSummary;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  categoryStats: CategoryStat[];
  executiveSummary: string;
  documentTypesDetected: DocumentType[];
  patientLabelHint: string | null;
  clinicianHint: string | null;
  periodHint: string | null;
  analyzerVersion: string;
};

export const ANALYZER_VERSION = "chart-scan-v3";
