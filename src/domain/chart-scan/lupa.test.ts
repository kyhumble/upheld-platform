import { describe, expect, it } from "vitest";
import { assessLupaRisk, inferClinicalGroupFamily } from "./lupa";
import { SAMPLE_CHART_TEXT } from "./sample-chart";

describe("LUPA assessment", () => {
  it("flags sample chart as LUPA risk", () => {
    const a = assessLupaRisk(SAMPLE_CHART_TEXT);
    expect(a.effectiveVisits).not.toBeNull();
    expect(["LIKELY_LUPA", "BORDERLINE"]).toContain(a.risk);
    expect(a.estimatedPaymentGap).toBeGreaterThan(0);
    expect(a.clinicalGroupHint).toBeTruthy();
  });

  it("infers wound clinical family", () => {
    expect(inferClinicalGroupFamily("Stage 2 pressure ulcer heel wound care")).toBe("WOUND");
  });

  it("returns NONE when visits are high", () => {
    const a = assessLupaRisk(
      "Visits completed: 12. Visits scheduled for 30-day period: 14 total skilled visits.",
    );
    expect(a.risk).toBe("NONE");
    expect(a.estimatedPaymentGap).toBe(0);
  });

  it("does not treat '30-day' as the scheduled visit count", () => {
    const a = assessLupaRisk(
      "Visits completed to date: 8 SN + 6 PT. Visits scheduled for 30-day period: 18 total skilled visits.",
    );
    // 8 SN + 6 PT = 14 skilled visits completed
    expect(a.visitsCompleted).toBe(14);
    expect(a.effectiveVisits).toBe(14);
    expect(a.visitsScheduled).not.toBe(30);
    expect(a.risk).toBe("NONE");
  });

  it("sums SN xN + PT xN patterns", () => {
    const a = assessLupaRisk(
      "Visits completed to date: SN x2, PT x1. Visits scheduled for 30-day period: 3 total skilled visits.",
    );
    expect(a.effectiveVisits).toBe(3);
    expect(a.risk).toBe("LIKELY_LUPA");
  });
});
