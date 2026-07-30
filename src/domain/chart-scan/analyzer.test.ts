import { describe, expect, it } from "vitest";
import { analyzeChartText } from "./analyzer";
import { SAMPLE_CHART_TEXT } from "./sample-chart";

describe("analyzeChartText", () => {
  it("flags insufficient text", () => {
    const r = analyzeChartText({ text: "too short" });
    expect(r.findings[0]?.severity).toBe("CRITICAL");
    expect(r.findings[0]?.title).toMatch(/Insufficient chart text/i);
    // Unusable packet must not look submission-ready
    expect(r.scores.readiness).toBeLessThanOrEqual(30);
    expect(r.revenueAtRisk).toBe(0);
  });

  it("produces multi-module findings on sample episode", () => {
    const r = analyzeChartText({
      text: SAMPLE_CHART_TEXT,
      fileName: "sample-episode.txt",
    });

    expect(r.findings.length).toBeGreaterThanOrEqual(5);
    expect(r.findings.some((f) => f.module === "CLINICAL")).toBe(true);
    expect(r.findings.some((f) => f.module === "COMPLIANCE")).toBe(true);
    expect(r.findings.some((f) => f.module === "REVENUE")).toBe(true);
    expect(r.severityCounts.critical).toBeGreaterThanOrEqual(1);
    // Chart-specific period cap (case-mix model); never multi-period fantasy
    expect(r.expectedPeriodPayment).toBeGreaterThan(1500);
    expect(r.revenueAtRisk).toBeGreaterThan(300);
    expect(r.revenueAtRisk).toBeLessThanOrEqual(r.expectedPeriodPayment);
    expect(r.revenueUpside).toBeGreaterThan(0);
    expect(r.revenueUpside).toBeLessThanOrEqual(r.expectedPeriodPayment);
    expect(r.findings.some((f) => f.impactType === "RECOVERY")).toBe(true);
    expect(r.findings.some((f) => f.impactType === "EXPOSURE")).toBe(true);
    expect(r.scores.readiness).toBeGreaterThan(0);
    expect(r.scores.readiness).toBeLessThan(90);
    expect(r.executiveSummary.toLowerCase()).toContain("readiness");
    expect(r.documentTypesDetected.length).toBeGreaterThan(0);
  });

  it("detects F2F and LUPA themes in sample", () => {
    const r = analyzeChartText({ text: SAMPLE_CHART_TEXT });
    const titles = r.findings.map((f) => f.title.toLowerCase()).join(" | ");
    expect(titles).toMatch(/face-to-face|f2f|homebound|lupa/);
  });
});
