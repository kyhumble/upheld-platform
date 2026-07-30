import { describe, expect, it } from "vitest";
import {
  CMS_LUPA_ILLUSTRATIVE_GAP,
  CMS_NATIONAL_30_DAY_PERIOD_PAYMENT,
  CMS_PAYMENT_YEAR,
  CMS_PER_VISIT_RATES_2026,
  REVENUE_DEFAULTS,
  TYPICAL_PERIOD_PAYMENT,
} from "./knowledge";

describe("CMS rate anchors", () => {
  it("uses CY 2026 national standardized 30-day period from HH PPS", () => {
    expect(CMS_PAYMENT_YEAR).toBe(2026);
    expect(CMS_NATIONAL_30_DAY_PERIOD_PAYMENT).toBe(2038.22);
    expect(TYPICAL_PERIOD_PAYMENT).toBe(CMS_NATIONAL_30_DAY_PERIOD_PAYMENT);
  });

  it("derives LUPA gap from CMS period minus SN per-visit × 5", () => {
    const expected = Math.round(
      CMS_NATIONAL_30_DAY_PERIOD_PAYMENT - 5 * CMS_PER_VISIT_RATES_2026.skilledNursing,
    );
    expect(CMS_LUPA_ILLUSTRATIVE_GAP).toBe(expected);
    expect(REVENUE_DEFAULTS.lupaFullPeriodGap).toBe(expected);
  });

  it("keeps per-finding dollars at or under one CMS period", () => {
    for (const [k, v] of Object.entries(REVENUE_DEFAULTS)) {
      expect(v, k).toBeLessThanOrEqual(CMS_NATIONAL_30_DAY_PERIOD_PAYMENT);
      expect(v, k).toBeGreaterThan(0);
    }
  });
});
