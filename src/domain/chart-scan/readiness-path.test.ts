import { describe, expect, it } from "vitest";
import {
  READINESS_GATE,
  liveScoresFromFindings,
  minimalPathToGate,
  orderFixPath,
  readinessFromFindings,
} from "./readiness-path";
import type { ScoreableFinding } from "./readiness-path";

function f(
  partial: Partial<ScoreableFinding> & Pick<ScoreableFinding, "id" | "severity" | "module">,
): ScoreableFinding {
  return {
    title: partial.title ?? partial.id,
    category: partial.category ?? "Test",
    suggestedCorrection: partial.suggestedCorrection ?? "Fix docs",
    status: partial.status ?? "OPEN",
    estimatedImpact: partial.estimatedImpact ?? 100,
    ...partial,
  };
}

describe("readiness path", () => {
  it("scores open findings only", () => {
    const findings = [
      f({ id: "1", module: "COMPLIANCE", severity: "CRITICAL", status: "OPEN" }),
      f({ id: "2", module: "CLINICAL", severity: "HIGH", status: "RESOLVED" }),
    ];
    const openOnly = readinessFromFindings(findings.filter((x) => x.status === "OPEN"));
    const allOpen = readinessFromFindings(
      findings.map((x) => ({ ...x, status: "OPEN" })),
    );
    expect(openOnly.readiness).toBeGreaterThan(allOpen.readiness);
  });

  it("orders critical compliance first", () => {
    const findings = [
      f({ id: "low", module: "REVENUE", severity: "LOW" }),
      f({ id: "crit", module: "COMPLIANCE", severity: "CRITICAL" }),
      f({ id: "high", module: "CLINICAL", severity: "HIGH" }),
    ];
    const ordered = orderFixPath(findings);
    expect(ordered[0].id).toBe("crit");
  });

  it("builds path that can cross gate", () => {
    const findings = [
      f({ id: "a", module: "COMPLIANCE", severity: "CRITICAL" }),
      f({ id: "b", module: "COMPLIANCE", severity: "CRITICAL" }),
      f({ id: "c", module: "CLINICAL", severity: "HIGH" }),
      f({ id: "d", module: "REVENUE", severity: "HIGH" }),
    ];
    const path = minimalPathToGate(findings, READINESS_GATE);
    expect(path.current).toBeLessThan(READINESS_GATE);
    expect(path.steps.length).toBeGreaterThan(0);
    expect(path.projectedIfAllFixed).toBeGreaterThanOrEqual(path.current);
    // Resolving all open → empty open set → high readiness
    expect(path.projectedIfAllFixed).toBeGreaterThanOrEqual(READINESS_GATE);
  });

  it("live score ignores resolved findings (ring/path agreement)", () => {
    const findings = [
      f({ id: "a", module: "COMPLIANCE", severity: "CRITICAL", status: "OPEN" }),
      f({ id: "b", module: "COMPLIANCE", severity: "CRITICAL", status: "RESOLVED" }),
      f({ id: "c", module: "REVENUE", severity: "HIGH", status: "RESOLVED" }),
    ];
    const allOpen = liveScoresFromFindings(
      findings.map((x) => ({ ...x, status: "OPEN" })),
    );
    const live = liveScoresFromFindings(findings);
    expect(live.readiness).toBeGreaterThan(allOpen.readiness);
    expect(live.resolvedOrDismissed).toBe(2);
    expect(live.openCount).toBe(1);
  });
});
