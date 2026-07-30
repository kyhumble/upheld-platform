"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChartFinding } from "@prisma/client";
import { formatCurrency } from "@/lib/utils";
import { Card, Badge, Button } from "./ui";
import { ModuleBadge, SeverityBadge } from "./severity-badge";
import { updateFindingStatusAction, bulkUpdateFindingsAction } from "@/server/actions/scans";
import { PrintButton } from "./print-button";

type FilterMoney = "all" | "RECOVERY" | "EXPOSURE";
type FilterStatus = "all" | "OPEN" | "RESOLVED" | "DISMISSED";
type FilterModule = "all" | "CLINICAL" | "COMPLIANCE" | "REVENUE";
type FilterSeverity = "all" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

function readHashFilters(): {
  money?: FilterMoney;
  module?: FilterModule;
  severity?: FilterSeverity;
  status?: FilterStatus;
} {
  if (typeof window === "undefined") return {};
  const raw = window.location.hash.replace(/^#/, "");
  // support #findings&money=RECOVERY or #findings?money=RECOVERY
  const q = raw.includes("?")
    ? raw.split("?")[1]
    : raw.includes("&")
      ? raw.slice(raw.indexOf("&") + 1)
      : raw.startsWith("findings")
        ? ""
        : raw;
  if (!q) return {};
  const params = new URLSearchParams(q.startsWith("money") || q.includes("=") ? q : "");
  // also parse from full hash like findings&money=RECOVERY
  const alt = new URLSearchParams(raw.replace(/^findings&?/, "").replace(/^findings\?/, ""));
  const get = (k: string) => params.get(k) ?? alt.get(k);
  const money = get("money");
  const module = get("module");
  const severity = get("severity");
  const status = get("status");
  return {
    money:
      money === "RECOVERY" || money === "EXPOSURE" || money === "all"
        ? (money as FilterMoney)
        : undefined,
    module:
      module === "CLINICAL" ||
      module === "COMPLIANCE" ||
      module === "REVENUE" ||
      module === "all"
        ? (module as FilterModule)
        : undefined,
    severity:
      severity === "CRITICAL" ||
      severity === "HIGH" ||
      severity === "MEDIUM" ||
      severity === "LOW" ||
      severity === "all"
        ? (severity as FilterSeverity)
        : undefined,
    status:
      status === "OPEN" ||
      status === "RESOLVED" ||
      status === "DISMISSED" ||
      status === "all"
        ? (status as FilterStatus)
        : undefined,
  };
}

function writeHash(filters: {
  money: FilterMoney;
  module: FilterModule;
  severity: FilterSeverity;
  status: FilterStatus;
}) {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams();
  if (filters.money !== "all") q.set("money", filters.money);
  if (filters.module !== "all") q.set("module", filters.module);
  if (filters.severity !== "all") q.set("severity", filters.severity);
  if (filters.status !== "OPEN") q.set("status", filters.status);
  const qs = q.toString();
  const next = qs ? `#findings&${qs}` : "#findings";
  if (window.location.hash !== next) {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}${next}`);
  }
}

export function FindingsPanel({
  findings,
  canResolve,
  scanToken,
}: {
  findings: ChartFinding[];
  canResolve: boolean;
  scanToken: string;
}) {
  const [money, setMoney] = useState<FilterMoney>("all");
  const [status, setStatus] = useState<FilterStatus>("OPEN");
  const [module, setModule] = useState<FilterModule>("all");
  const [severity, setSeverity] = useState<FilterSeverity>("all");

  useEffect(() => {
    const h = readHashFilters();
    if (h.money) setMoney(h.money);
    if (h.module) setModule(h.module);
    if (h.severity) setSeverity(h.severity);
    if (h.status) setStatus(h.status);
    const onHash = () => {
      const next = readHashFilters();
      if (next.money) setMoney(next.money);
      if (next.module) setModule(next.module);
      if (next.severity) setSeverity(next.severity);
      if (next.status) setStatus(next.status);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    writeHash({ money, module, severity, status });
  }, [money, module, severity, status]);

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (money !== "all" && (f.impactType || "EXPOSURE") !== money) return false;
      if (status !== "all" && f.status !== status) return false;
      if (module !== "all" && f.module !== module) return false;
      if (severity !== "all" && f.severity !== severity) return false;
      return true;
    });
  }, [findings, money, status, module, severity]);

  const openIds = filtered.filter((f) => f.status === "OPEN").map((f) => f.id);
  const capture = filtered
    .filter((f) => f.impactType === "RECOVERY")
    .reduce((s, f) => s + (f.estimatedImpact ?? 0), 0);
  const protect = filtered
    .filter((f) => f.impactType === "EXPOSURE")
    .reduce((s, f) => s + (f.estimatedImpact ?? 0), 0);

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold transition ${
      active
        ? "bg-navy text-white"
        : "border border-border bg-white text-muted hover:border-navy/20 hover:text-navy"
    }`;

  return (
    <div id="findings">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-navy">Prioritized findings</h2>
          <p className="text-sm text-muted">
            Filter by capture vs protect · human review required before claim action
          </p>
        </div>
        <div className="hidden sm:block">
          <PrintButton />
        </div>
      </div>

      <div className="no-print mb-4 space-y-3 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-[11px] font-semibold uppercase text-muted">Money</span>
          {(
            [
              ["all", "All"],
              ["RECOVERY", "Capture (+)"],
              ["EXPOSURE", "Protect (−)"],
            ] as const
          ).map(([v, l]) => (
            <button key={v} type="button" className={pill(money === v)} onClick={() => setMoney(v)}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-[11px] font-semibold uppercase text-muted">Severity</span>
          {(
            [
              ["all", "All"],
              ["CRITICAL", "Critical"],
              ["HIGH", "High"],
              ["MEDIUM", "Medium"],
              ["LOW", "Low"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              className={pill(severity === v)}
              onClick={() => setSeverity(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-[11px] font-semibold uppercase text-muted">Status</span>
          {(
            [
              ["all", "All"],
              ["OPEN", "Open"],
              ["RESOLVED", "Resolved"],
              ["DISMISSED", "Dismissed"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              className={pill(status === v)}
              onClick={() => setStatus(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-[11px] font-semibold uppercase text-muted">Module</span>
          {(
            [
              ["all", "All"],
              ["CLINICAL", "Clinical"],
              ["COMPLIANCE", "Compliance"],
              ["REVENUE", "Revenue"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              className={pill(module === v)}
              onClick={() => setModule(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs">
          <p className="text-muted">
            Showing <strong className="text-navy">{filtered.length}</strong> of {findings.length}
            {capture > 0 ? (
              <button
                type="button"
                className="ml-2 font-semibold text-ok hover:underline"
                onClick={() => setMoney("RECOVERY")}
              >
                · +{formatCurrency(capture)} capture in view
              </button>
            ) : null}
            {protect > 0 ? (
              <button
                type="button"
                className="ml-2 font-semibold text-danger hover:underline"
                onClick={() => setMoney("EXPOSURE")}
              >
                · {formatCurrency(protect)} protect in view
              </button>
            ) : null}
          </p>
          {canResolve && openIds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <form action={bulkUpdateFindingsAction}>
                <input type="hidden" name="scanToken" value={scanToken} />
                <input type="hidden" name="findingIds" value={openIds.join(",")} />
                <input type="hidden" name="status" value="RESOLVED" />
                <Button type="submit" size="sm" variant="primary">
                  Resolve {openIds.length} open in view
                </Button>
              </form>
              <form action={bulkUpdateFindingsAction}>
                <input type="hidden" name="scanToken" value={scanToken} />
                <input type="hidden" name="findingIds" value={openIds.join(",")} />
                <input type="hidden" name="status" value="DISMISSED" />
                <Button type="submit" size="sm" variant="secondary">
                  Dismiss open in view
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="p-6 text-sm text-muted">No findings match these filters.</Card>
        ) : (
          filtered.map((f, idx) => (
            <article
              key={f.id}
              id={`finding-${f.id}`}
              className="rounded-xl border border-border bg-white p-5 shadow-sm print:break-inside-avoid"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted">#{idx + 1}</span>
                  <button type="button" onClick={() => setSeverity(f.severity as FilterSeverity)}>
                    <SeverityBadge severity={f.severity} />
                  </button>
                  <button type="button" onClick={() => setModule(f.module as FilterModule)}>
                    <ModuleBadge module={f.module} />
                  </button>
                  <Badge
                    tone={
                      f.impactType === "RECOVERY"
                        ? "ok"
                        : f.impactType === "EXPOSURE"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setMoney(
                          f.impactType === "RECOVERY" || f.impactType === "EXPOSURE"
                            ? f.impactType
                            : "all",
                        )
                      }
                    >
                      {f.impactType === "RECOVERY"
                        ? "CAPTURE"
                        : f.impactType === "EXPOSURE"
                          ? "PROTECT"
                          : "INFO"}
                    </button>
                  </Badge>
                  <Badge tone="neutral">{f.category}</Badge>
                  {f.status !== "OPEN" ? <Badge tone="ok">{f.status}</Badge> : null}
                </div>
                {f.estimatedImpact != null && f.estimatedImpact > 0 ? (
                  <button
                    type="button"
                    className="text-right"
                    onClick={() =>
                      setMoney(
                        f.impactType === "RECOVERY" || f.impactType === "EXPOSURE"
                          ? f.impactType
                          : "all",
                      )
                    }
                  >
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        f.impactType === "RECOVERY" ? "text-ok" : "text-danger"
                      }`}
                    >
                      {formatCurrency(f.estimatedImpact)}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {f.impactType === "RECOVERY"
                        ? "could add if fixed"
                        : f.impactType === "EXPOSURE"
                          ? "at risk if submitted"
                          : "advisory"}
                    </p>
                  </button>
                ) : (
                  <p className="text-xs text-muted">No direct $ mapped</p>
                )}
              </div>
              <h3 className="mt-3 text-[15px] font-semibold text-navy">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/85">{f.description}</p>
              <div className="mt-4 rounded-lg border border-teal/20 bg-teal-light/50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
                  Suggested correction
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink/90">{f.suggestedCorrection}</p>
              </div>
              {f.cmsReference ? (
                <p className="mt-3 text-xs text-muted">
                  <span className="font-semibold text-navy/80">CMS / regulatory:</span>{" "}
                  {f.cmsReference}
                </p>
              ) : null}
              {f.evidenceExcerpt ? (
                <blockquote className="mt-3 border-l-2 border-border pl-3 text-xs italic text-muted">
                  “{f.evidenceExcerpt}”
                </blockquote>
              ) : null}

              {canResolve && f.status === "OPEN" ? (
                <div className="no-print mt-4 flex flex-wrap gap-2">
                  <form action={updateFindingStatusAction}>
                    <input type="hidden" name="findingId" value={f.id} />
                    <input type="hidden" name="status" value="RESOLVED" />
                    <input type="hidden" name="scanToken" value={scanToken} />
                    <Button type="submit" size="sm" variant="primary">
                      Mark resolved
                    </Button>
                  </form>
                  <form action={updateFindingStatusAction}>
                    <input type="hidden" name="findingId" value={f.id} />
                    <input type="hidden" name="status" value="DISMISSED" />
                    <input type="hidden" name="scanToken" value={scanToken} />
                    <Button type="submit" size="sm" variant="secondary">
                      Dismiss
                    </Button>
                  </form>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
