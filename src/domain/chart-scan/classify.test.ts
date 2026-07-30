import { describe, expect, it } from "vitest";
import { extractClinicianHint, extractPatientLabel } from "./classify";
import { SAMPLE_CHART_TEXT, SAMPLE_CLEAN_CHART_TEXT } from "./sample-chart";

describe("extractClinicianHint", () => {
  it("pulls assessing clinician from at-risk sample", () => {
    expect(extractClinicianHint(SAMPLE_CHART_TEXT)).toMatch(/Sam Rivera/i);
  });

  it("pulls assessing clinician from strong sample", () => {
    expect(extractClinicianHint(SAMPLE_CLEAN_CHART_TEXT)).toMatch(/Jordan Miles/i);
  });

  it("still extracts patient labels", () => {
    expect(extractPatientLabel(SAMPLE_CHART_TEXT)).toMatch(/Demo Patient A/i);
  });
});
