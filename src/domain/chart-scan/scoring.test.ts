import { describe, expect, it } from "vitest";
import { sumRevenueAtRisk, sumRevenueUpside } from "./scoring";
import type { AnalysisFinding } from "./types";

function f(
  partial: Partial<AnalysisFinding> &
    Pick<AnalysisFinding, "category" | "estimatedImpact" | "impactType">,
): AnalysisFinding {
  return {
    module: "COMPLIANCE",
    severity: "CRITICAL",
    title: "t",
    description: "d",
    suggestedCorrection: "s",
    cmsReference: null,
    evidenceExcerpt: null,
    ...partial,
  };
}

describe("revenue protect vs capture", () => {
  it("separates recovery upside from denial/LUPA exposure", () => {
    const findings = [
      f({ category: "Face-to-face", estimatedImpact: 900, impactType: "EXPOSURE" }),
      f({ category: "Homebound", estimatedImpact: 750, impactType: "EXPOSURE" }),
      f({
        module: "REVENUE",
        category: "LUPA risk",
        estimatedImpact: 700,
        impactType: "EXPOSURE",
      }),
      f({
        module: "REVENUE",
        category: "Comorbidity capture",
        estimatedImpact: 220,
        impactType: "RECOVERY",
      }),
      f({
        module: "CLINICAL",
        category: "Diagnosis specificity",
        estimatedImpact: 224,
        impactType: "RECOVERY",
      }),
    ];

    // Exposure: max(denial 900, other 700) = 900
    expect(sumRevenueAtRisk(findings)).toBe(900);
    // Upside: 220+224
    expect(sumRevenueUpside(findings)).toBe(444);
  });
});
