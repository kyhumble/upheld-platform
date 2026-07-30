import { cn } from "@/lib/utils";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function Card({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  /** Subtle lift on hover (site-wide motion) */
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-white shadow-sm",
        hover && "app-card-hover",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-navy">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "teal" | "danger" | "warn" | "ok" | "navy";
  className?: string;
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700",
    teal: "bg-teal-light text-teal",
    danger: "bg-red-50 text-danger",
    warn: "bg-amber-50 text-warn",
    ok: "bg-emerald-50 text-ok",
    navy: "bg-[#e8eef4] text-navy",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const variants = {
    primary: "bg-teal text-white hover:bg-[#06968b] disabled:opacity-50",
    secondary: "bg-white text-navy border border-border hover:bg-surface",
    ghost: "bg-transparent text-navy hover:bg-surface",
    danger: "bg-danger text-white hover:bg-red-800",
  };
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-3.5 py-2 text-sm",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  children,
  htmlFor,
  className,
}: {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("mb-1 block text-xs font-semibold text-muted", className)}
    >
      {children}
    </label>
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "teal" | "danger" | "warn";
  /** When set, the whole KPI is a clickable link */
  href?: string;
}) {
  const valueColor =
    tone === "teal"
      ? "text-teal"
      : tone === "danger"
        ? "text-danger"
        : tone === "warn"
          ? "text-warn"
          : "text-navy";
  const inner = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", valueColor)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {href ? (
        <p className="mt-2 text-[11px] font-semibold text-teal opacity-0 transition group-hover:opacity-100">
          View →
        </p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="app-stat-pulse group block rounded-xl border border-border bg-white p-4 shadow-sm transition hover:border-teal/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/30"
      >
        {inner}
      </a>
    );
  }

  return (
    <Card className="app-stat-pulse p-4" hover>
      {inner}
    </Card>
  );
}
