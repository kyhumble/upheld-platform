import { Badge } from "./ui";

export function SeverityBadge({ severity }: { severity: string }) {
  const tone =
    severity === "CRITICAL"
      ? "danger"
      : severity === "HIGH"
        ? "warn"
        : severity === "MEDIUM"
          ? "navy"
          : "neutral";
  return <Badge tone={tone}>{severity}</Badge>;
}

export function ModuleBadge({ module }: { module: string }) {
  const label =
    module === "CLINICAL"
      ? "Clinical Integrity"
      : module === "COMPLIANCE"
        ? "Compliance"
        : "Revenue";
  return <Badge tone="teal">{label}</Badge>;
}

export function ScoreRing({
  score,
  label,
  size = 88,
  href,
  hint,
  emphasize,
}: {
  score: number;
  label: string;
  size?: number;
  href?: string;
  /** Secondary line under label (e.g. "Click to fix path") */
  hint?: string;
  /** Pulse / stronger border when action needed */
  emphasize?: boolean;
}) {
  const tone =
    score >= 85 ? "text-ok" : score >= 70 ? "text-teal" : score >= 50 ? "text-warn" : "text-danger";
  const ring =
    score >= 85
      ? "border-ok/40"
      : score >= 70
        ? "border-teal/40"
        : score >= 50
          ? "border-warn/40"
          : "border-danger/40";

  const body = (
    <>
      <div
        className={`flex items-center justify-center rounded-full border-4 bg-white transition group-hover:scale-[1.03] ${ring} ${
          emphasize ? "ring-2 ring-warn/50 ring-offset-2" : ""
        }`}
        style={{ width: size, height: size }}
      >
        <span className={`text-2xl font-bold tabular-nums ${tone}`}>{score}</span>
      </div>
      <span className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted group-hover:text-teal">
        {label}
      </span>
      {hint ? (
        <span
          className={`max-w-[7.5rem] text-center text-[10px] font-semibold leading-tight ${
            emphasize ? "text-warn" : "text-teal"
          }`}
        >
          {hint}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className="group flex flex-col items-center gap-1.5">
        {body}
      </a>
    );
  }

  return <div className="flex flex-col items-center gap-1.5">{body}</div>;
}
