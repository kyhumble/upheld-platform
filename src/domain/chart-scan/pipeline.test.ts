import { describe, expect, it } from "vitest";
import { runChartScanPipeline } from "./pipeline";
import { SAMPLE_CHART_TEXT } from "./sample-chart";

describe("runChartScanPipeline", () => {
  it("returns LUPA meta and multi-module findings", async () => {
    const r = await runChartScanPipeline({
      text: SAMPLE_CHART_TEXT,
      fileName: "sample.txt",
      enableLlm: false,
    });

    expect(r.findings.length).toBeGreaterThanOrEqual(5);
    expect(r.meta.lupa.risk === "LIKELY_LUPA" || r.meta.lupa.risk === "BORDERLINE").toBe(
      true,
    );
    expect(r.meta.llm.used).toBe(false);
    expect(r.expectedPeriodPayment).toBeGreaterThan(1500);
    expect(r.revenueAtRisk).toBeGreaterThan(300);
    expect(r.revenueAtRisk).toBeLessThanOrEqual(r.expectedPeriodPayment);
    expect(r.revenueUpside).toBeGreaterThanOrEqual(0);
    expect(r.revenueUpside).toBeLessThanOrEqual(r.expectedPeriodPayment);
    expect(r.analyzerVersion).toContain("lupa");
  });
});
