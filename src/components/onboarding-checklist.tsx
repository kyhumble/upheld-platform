import Link from "next/link";
import { Card, CardHeader, Badge } from "./ui";

export type OnboardingState = {
  hasScan: boolean;
  hasCompleteScan: boolean;
  hasBatch: boolean;
  hasResolvedFinding: boolean;
  baaSigned: boolean;
  pilotInterest: boolean;
  pilotPaid?: boolean;
};

export function OnboardingChecklist({ state }: { state: OnboardingState }) {
  const items = [
    {
      done: state.hasBatch,
      title: "Run a retrospective batch",
      detail: "Primary proof: labeled paid / denied / LUPA claims → would-have-caught rate.",
      href: "/batch",
    },
    {
      done: state.hasScan,
      title: "Run one Free Chart Scan",
      detail: "Sample or de-identified packet — see readiness path + capture/protect $.",
      href: "/scan",
    },
    {
      done: state.hasCompleteScan,
      title: "Review capture vs protect dollars",
      detail: "Open a report and filter findings by Capture / Protect.",
      href: "/scans",
    },
    {
      done: state.hasResolvedFinding,
      title: "Resolve or dismiss a finding",
      detail: "Human-in-the-loop: accept, fix, or dismiss AI-surfaced issues.",
      href: "/issues",
    },
    {
      done: state.baaSigned,
      title: "Set BAA status",
      detail: "Mark BAA pending/signed before identifiable PHI.",
      href: "/settings",
    },
    {
      done: state.pilotInterest || !!state.pilotPaid,
      title: state.pilotPaid ? "Pilot paid" : "Request a 30-day pilot",
      detail: state.pilotPaid
        ? "Paid pilot is active — align success metrics with Upheld."
        : "Convert catch rate + recoverable $ into ongoing monitoring.",
      href: "/settings",
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  if (doneCount >= items.length) return null;

  return (
    <Card>
      <CardHeader
        title="Getting started"
        subtitle={`${doneCount} of ${items.length} complete · Phase 1 path`}
        action={<Badge tone="teal">Onboarding</Badge>}
      />
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.title} className="flex items-start gap-3 px-5 py-3.5">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                item.done ? "bg-ok text-white" : "border border-border text-muted"
              }`}
              aria-hidden
            >
              {item.done ? "✓" : ""}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${item.done ? "text-muted line-through" : "text-navy"}`}>
                {item.title}
              </p>
              <p className="text-xs text-muted">{item.detail}</p>
            </div>
            {!item.done ? (
              <Link
                href={item.href}
                className="shrink-0 text-xs font-semibold text-teal hover:underline"
              >
                Go →
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
