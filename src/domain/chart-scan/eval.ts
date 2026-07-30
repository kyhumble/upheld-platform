/**
 * Lightweight accuracy eval for Free Chart Scan.
 * Compares pipeline output to golden expected titles/categories/impact types.
 */

import { runChartScanPipeline } from "./pipeline";
import type { AnalysisFinding } from "./types";

export type GoldenCase = {
  id: string;
  fileName: string;
  text: string;
  /** Titles that must appear (case-insensitive substring match OK) */
  mustIncludeTitle: string[];
  /** Titles that must NOT appear */
  mustExcludeTitle?: string[];
  /** Categories that must appear at least once */
  mustIncludeCategory?: string[];
  /** Expected impact types present */
  mustIncludeImpactType?: Array<"RECOVERY" | "EXPOSURE" | "NEUTRAL">;
  maxReadiness?: number;
  minReadiness?: number;
  maxRevenueAtRisk?: number;
  minRevenueUpside?: number;
};

export type EvalCaseResult = {
  id: string;
  pass: boolean;
  failures: string[];
  readiness: number;
  revenueAtRisk: number;
  revenueUpside: number;
  findingCount: number;
  titles: string[];
};

function hasTitle(findings: AnalysisFinding[], needle: string): boolean {
  const n = needle.toLowerCase();
  return findings.some((f) => f.title.toLowerCase().includes(n));
}

function hasCategory(findings: AnalysisFinding[], needle: string): boolean {
  const n = needle.toLowerCase();
  return findings.some((f) => f.category.toLowerCase().includes(n));
}

export async function evalGoldenCase(c: GoldenCase): Promise<EvalCaseResult> {
  const r = await runChartScanPipeline({
    text: c.text,
    fileName: c.fileName,
    enableLlm: false,
  });
  const failures: string[] = [];

  for (const t of c.mustIncludeTitle) {
    if (!hasTitle(r.findings, t)) failures.push(`missing title ~ "${t}"`);
  }
  for (const t of c.mustExcludeTitle ?? []) {
    if (hasTitle(r.findings, t)) failures.push(`unexpected title ~ "${t}"`);
  }
  for (const cat of c.mustIncludeCategory ?? []) {
    if (!hasCategory(r.findings, cat)) failures.push(`missing category ~ "${cat}"`);
  }
  for (const it of c.mustIncludeImpactType ?? []) {
    if (!r.findings.some((f) => f.impactType === it)) {
      failures.push(`missing impactType ${it}`);
    }
  }
  if (c.maxReadiness != null && r.scores.readiness > c.maxReadiness) {
    failures.push(`readiness ${r.scores.readiness} > max ${c.maxReadiness}`);
  }
  if (c.minReadiness != null && r.scores.readiness < c.minReadiness) {
    failures.push(`readiness ${r.scores.readiness} < min ${c.minReadiness}`);
  }
  if (c.maxRevenueAtRisk != null && r.revenueAtRisk > c.maxRevenueAtRisk) {
    failures.push(`revenueAtRisk ${r.revenueAtRisk} > max ${c.maxRevenueAtRisk}`);
  }
  if (c.minRevenueUpside != null && r.revenueUpside < c.minRevenueUpside) {
    failures.push(`revenueUpside ${r.revenueUpside} < min ${c.minRevenueUpside}`);
  }

  return {
    id: c.id,
    pass: failures.length === 0,
    failures,
    readiness: r.scores.readiness,
    revenueAtRisk: r.revenueAtRisk,
    revenueUpside: r.revenueUpside,
    findingCount: r.findings.length,
    titles: r.findings.map((f) => f.title),
  };
}

export async function runEvalSuite(cases: GoldenCase[]): Promise<{
  passed: number;
  failed: number;
  results: EvalCaseResult[];
}> {
  const results: EvalCaseResult[] = [];
  for (const c of cases) {
    results.push(await evalGoldenCase(c));
  }
  return {
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    results,
  };
}
