import { describe, expect, it } from "vitest";
import { runChartScanPipeline } from "@/domain/chart-scan/pipeline";
import { getSampleChart } from "@/domain/chart-scan/sample-chart";
import {
  aggregateBatchItems,
  normalizeOutcome,
  scoreWouldHaveCaught,
} from "./retrospective";
import { parseManifestCsv, buildSampleRetrospectiveManifest } from "./parse-manifest";
import { runBatchClaims } from "./run-batch";

describe("retrospective batch scoring", () => {
  it("normalizes outcomes", () => {
    expect(normalizeOutcome("denied")).toBe("DENIED");
    expect(normalizeOutcome("Paid Clean")).toBe("PAID_CLEAN");
    expect(normalizeOutcome("partial-denial")).toBe("PARTIAL_DENIAL");
  });

  it("parses manifest CSV", () => {
    const csv = `claimId,outcome,knownLossUsd,knownReason,chartText
C1,DENIED,2000,Face-to-face missing,"Patient homebound Face-to-face incomplete OASIS visit notes"
C2,PAID_CLEAN,0,,"Clean strong documentation episode with signatures"
`;
    const { rows, errors } = parseManifestCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0].knownOutcome).toBe("DENIED");
    expect(rows[0].knownLossUsd).toBe(2000);
  });

  it("flags at-risk sample as catchable for DENIED F2F", async () => {
    const text = getSampleChart("at-risk").text;
    const result = await runChartScanPipeline({ text, fileName: "x.txt", enableLlm: false });
    const catch_ = scoreWouldHaveCaught({
      knownOutcome: "DENIED",
      knownReason: "Face-to-face missing",
      findings: result.findings,
    });
    expect(catch_.wouldHaveCaught).toBe(true);
  });

  it("sample batch achieves catch rate on adverse claims", async () => {
    const rows = buildSampleRetrospectiveManifest();
    const { aggregate, results } = await runBatchClaims(rows, { concurrency: 2 });
    expect(results.length).toBe(rows.length);
    expect(aggregate.processedCount).toBeGreaterThanOrEqual(4);
    expect(aggregate.adverseCount).toBeGreaterThanOrEqual(3);
    expect(aggregate.caughtCount).toBeGreaterThanOrEqual(2);
    expect(aggregate.catchRate).not.toBeNull();
    expect(aggregate.catchRate!).toBeGreaterThanOrEqual(40);
  }, 30_000);

  it("aggregates catch metrics", () => {
    const a = aggregateBatchItems([
      {
        status: "COMPLETE",
        knownOutcome: "DENIED",
        knownLossUsd: 1000,
        wouldHaveCaught: true,
        revenueAtRisk: 500,
        revenueUpside: 0,
      },
      {
        status: "COMPLETE",
        knownOutcome: "DENIED",
        knownLossUsd: 500,
        wouldHaveCaught: false,
        revenueAtRisk: 0,
        revenueUpside: 0,
      },
      {
        status: "COMPLETE",
        knownOutcome: "PAID_CLEAN",
        knownLossUsd: 0,
        wouldHaveCaught: false,
        revenueAtRisk: 0,
        revenueUpside: 0,
      },
    ]);
    expect(a.adverseCount).toBe(2);
    expect(a.caughtCount).toBe(1);
    expect(a.missedCount).toBe(1);
    expect(a.recoverableUsd).toBe(1000);
    expect(a.catchRate).toBe(50);
  });
});
