/**
 * Execute retrospective analysis for a list of claims.
 */

import { runChartScanPipeline } from "@/domain/chart-scan/pipeline";
import { encryptField } from "@/lib/crypto";
import {
  aggregateBatchItems,
  scoreWouldHaveCaught,
  summarizeResult,
  type KnownOutcome,
} from "./retrospective";
import type { ManifestRow } from "./parse-manifest";

export type RunnableClaim = ManifestRow & {
  chartText: string;
};

export type BatchItemResult = {
  claimId: string;
  status: "COMPLETE" | "FAILED";
  knownOutcome: KnownOutcome;
  knownLossUsd: number | null;
  knownReason: string | null;
  fileName: string | null;
  patientLabel: string | null;
  readinessScore: number | null;
  revenueAtRisk: number | null;
  revenueUpside: number | null;
  criticalCount: number;
  highCount: number;
  findingTitles: string[];
  categories: string[];
  wouldHaveCaught: boolean | null;
  matchReason: string | null;
  errorMessage: string | null;
  chartTextStored: string;
  summaryJson: string;
};

export async function analyzeClaimForBatch(
  row: RunnableClaim,
  opts?: { wageIndex?: number | null },
): Promise<BatchItemResult> {
  const text = row.chartText?.trim() ?? "";
  if (text.length < 40) {
    return {
      claimId: row.claimId,
      status: "FAILED",
      knownOutcome: row.knownOutcome,
      knownLossUsd: row.knownLossUsd,
      knownReason: row.knownReason,
      fileName: row.fileName,
      patientLabel: null,
      readinessScore: null,
      revenueAtRisk: null,
      revenueUpside: null,
      criticalCount: 0,
      highCount: 0,
      findingTitles: [],
      categories: [],
      wouldHaveCaught: null,
      matchReason: null,
      errorMessage: "Chart text too short to analyze",
      chartTextStored: encryptField(text),
      summaryJson: "{}",
    };
  }

  try {
    const result = await runChartScanPipeline({
      text,
      fileName: row.fileName ?? `${row.claimId}.txt`,
      enableLlm: false,
      wageIndex: opts?.wageIndex ?? null,
    });
    const catchScore = scoreWouldHaveCaught({
      knownOutcome: row.knownOutcome,
      knownReason: row.knownReason,
      findings: result.findings,
    });
    const sum = summarizeResult(result);

    // False pressure count uses PAID_CLEAN + criticals — fold into wouldHaveCaught false + matchReason
    return {
      claimId: row.claimId,
      status: "COMPLETE",
      knownOutcome: row.knownOutcome,
      knownLossUsd: row.knownLossUsd,
      knownReason: row.knownReason,
      fileName: row.fileName,
      patientLabel: sum.patientLabel,
      readinessScore: sum.readinessScore,
      revenueAtRisk: sum.revenueAtRisk,
      revenueUpside: sum.revenueUpside,
      criticalCount: sum.criticalCount,
      highCount: sum.highCount,
      findingTitles: sum.titles,
      categories: sum.categories,
      wouldHaveCaught: catchScore.wouldHaveCaught,
      matchReason: catchScore.matchReason,
      errorMessage: null,
      chartTextStored: encryptField(text),
      summaryJson: JSON.stringify({
        executiveSummary: result.executiveSummary,
        matchedTitles: catchScore.matchedTitles,
        scores: result.scores,
        analyzerVersion: result.analyzerVersion,
      }),
    };
  } catch (e) {
    return {
      claimId: row.claimId,
      status: "FAILED",
      knownOutcome: row.knownOutcome,
      knownLossUsd: row.knownLossUsd,
      knownReason: row.knownReason,
      fileName: row.fileName,
      patientLabel: null,
      readinessScore: null,
      revenueAtRisk: null,
      revenueUpside: null,
      criticalCount: 0,
      highCount: 0,
      findingTitles: [],
      categories: [],
      wouldHaveCaught: null,
      matchReason: null,
      errorMessage: e instanceof Error ? e.message : "Analysis failed",
      chartTextStored: encryptField(text),
      summaryJson: "{}",
    };
  }
}

/** Sequential analyze with optional concurrency limit (default 3). */
export async function runBatchClaims(
  rows: RunnableClaim[],
  opts?: { concurrency?: number; onProgress?: (done: number, total: number) => void },
): Promise<{ results: BatchItemResult[]; aggregate: ReturnType<typeof aggregateBatchItems> }> {
  const concurrency = Math.max(1, Math.min(opts?.concurrency ?? 3, 8));
  const results: BatchItemResult[] = new Array(rows.length);
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < rows.length) {
      const i = cursor++;
      results[i] = await analyzeClaimForBatch(rows[i]);
      done += 1;
      opts?.onProgress?.(done, rows.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, () => worker()));

  // false pressure recount
  const forAgg = results.map((r) => ({
    status: r.status,
    knownOutcome: r.knownOutcome,
    knownLossUsd: r.knownLossUsd,
    wouldHaveCaught: r.wouldHaveCaught,
    revenueAtRisk: r.revenueAtRisk,
    revenueUpside: r.revenueUpside,
  }));
  const aggregate = aggregateBatchItems(forAgg);

  // Count false pressure from match reasons
  let falsePressure = 0;
  for (const r of results) {
    if (
      r.knownOutcome === "PAID_CLEAN" &&
      r.matchReason?.toLowerCase().includes("false pressure")
    ) {
      falsePressure += 1;
    }
  }
  aggregate.falsePressureCount = falsePressure;

  return { results, aggregate };
}
