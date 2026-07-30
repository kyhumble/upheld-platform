import { describe, expect, it } from "vitest";
import { runEvalSuite } from "./eval";
import { GOLDEN_CASES } from "./eval-fixtures";

describe("Free Chart Scan golden eval", () => {
  it("passes launch-gate fixtures", async () => {
    const suite = await runEvalSuite(GOLDEN_CASES);
    for (const r of suite.results) {
      if (!r.pass) {
        console.error(r.id, r.failures, {
          readiness: r.readiness,
          risk: r.revenueAtRisk,
          upside: r.revenueUpside,
          titles: r.titles,
        });
      }
      expect(r.pass, `${r.id}: ${r.failures.join("; ")}`).toBe(true);
    }
    expect(suite.failed).toBe(0);
    expect(suite.passed).toBe(GOLDEN_CASES.length);
  }, 30_000);
});
