import { describe, expect, it } from "vitest";
import {
  buildPilotConfirmationEmail,
  buildPilotLeadNotifyEmail,
  buildScanReportEmail,
} from "./email";

describe("email templates", () => {
  it("report email includes capture and protect", () => {
    const e = buildScanReportEmail({
      to: "qa@agency.com",
      contactName: "Jordan",
      agencyName: "Summit HH",
      publicToken: "tok_abc",
      readinessScore: 55,
      revenueAtRisk: 1442,
      revenueUpside: 326,
      criticalCount: 3,
      highCount: 4,
    });
    expect(e.subject).toMatch(/Capture/);
    expect(e.subject).toMatch(/Protect/);
    expect(e.subject).toMatch(/Period/);
    expect(e.text).toMatch(/\$326/);
    expect(e.text).toMatch(/\$1,442/);
    expect(e.text).toMatch(/\$2,038/);
    expect(e.html).toMatch(/capture/i);
    expect(e.html).toMatch(/Expected period/i);
    expect(e.html).toMatch(/tok_abc/);
    expect(e.text).toMatch(/ky@getupheld\.com/);
    expect(e.html).toMatch(/ky@getupheld\.com/);
  });

  it("pilot confirmation includes report link when present", () => {
    const e = buildPilotConfirmationEmail({
      to: "qa@agency.com",
      contactName: "Jordan",
      agencyName: "Summit",
      reportUrl: "https://upheld-platform.vercel.app/scan/xyz",
    });
    expect(e.subject).toMatch(/pilot/i);
    expect(e.html).toContain("/scan/xyz");
  });

  it("lead notify is ops-readable", () => {
    const e = buildPilotLeadNotifyEmail({
      contactEmail: "qa@agency.com",
      agencyName: "Summit",
      source: "scan_report_cta",
      readinessScore: 55,
      revenueUpside: 100,
      revenueAtRisk: 500,
    });
    expect(e.subject).toMatch(/Pilot lead/);
    expect(e.text).toContain("qa@agency.com");
  });
});
