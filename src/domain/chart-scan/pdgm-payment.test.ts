import { describe, expect, it } from "vitest";
import { getSampleChart } from "./sample-chart";
import { CMS_NATIONAL_30_DAY_PERIOD_PAYMENT } from "./knowledge";
import {
  estimatePeriodPayment,
  inferComorbidityBand,
  inferFunctionalBand,
  inferTiming,
  scaleToExpectedPeriod,
} from "./pdgm-payment";

describe("PDGM payment intelligence", () => {
  it("infers comorbidity and timing from sample at-risk chart", () => {
    const text = getSampleChart("at-risk").text;
    expect(["LOW", "HIGH", "NONE", "UNKNOWN"]).toContain(inferComorbidityBand(text));
    expect(["EARLY", "LATE", "UNKNOWN"]).toContain(inferTiming(text));
    const est = estimatePeriodPayment(text);
    expect(est.expectedPeriodPayment).toBeGreaterThan(1200);
    expect(est.expectedPeriodPayment).toBeLessThan(4500);
    expect(est.nationalBase).toBe(CMS_NATIONAL_30_DAY_PERIOD_PAYMENT);
    expect(est.caseMixWeight).toBeGreaterThan(0.5);
    expect(est.basis).toMatch(/case-mix weight/i);
  });

  it("wound + high function signals raise weight vs bare MMTA", () => {
    const wound = estimatePeriodPayment(
      "Primary wound care pressure ulcer stage 3. M1860 Ambulation 4. Early period community. CHF COPD diabetes CKD.",
    );
    const bare = estimatePeriodPayment("Home health episode note. Medication teaching.");
    expect(wound.expectedPeriodPayment).toBeGreaterThan(bare.expectedPeriodPayment);
  });

  it("scales national dollars to chart period", () => {
    const scaled = scaleToExpectedPeriod(1000, 2500);
    expect(scaled).toBeGreaterThan(1000);
    expect(scaled).toBeLessThanOrEqual(2500);
  });

  it("reads OASIS functional scores", () => {
    expect(
      inferFunctionalBand("M1800 4 M1810 4 M1820 4 M1830 4 M1840 3 M1850 3 M1860 5"),
    ).toBe("HIGH");
    expect(
      inferFunctionalBand("M1800 0 M1810 1 M1820 1 M1830 1 M1840 0 M1850 1 M1860 1"),
    ).toBe("LOW");
  });
});
