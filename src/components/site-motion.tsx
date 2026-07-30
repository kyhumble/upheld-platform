"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/** Fade + lift when scrolled into view (once). */
export function Reveal({
  children,
  className = "",
  delayMs = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  as?: "div" | "section" | "article" | "li";
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -32px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`mkt-reveal ${visible ? "is-visible" : ""} ${className}`}
      style={delayMs ? ({ transitionDelay: `${delayMs}ms` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}

/** Immediate staggered entrance for page chrome (no scroll wait). */
export function PageEnter({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: 0 | 1 | 2 | 3 | 4 | 5;
}) {
  const delayClass =
    delay === 0
      ? ""
      : delay === 1
        ? "mkt-delay-1"
        : delay === 2
          ? "mkt-delay-2"
          : delay === 3
            ? "mkt-delay-3"
            : delay === 4
              ? "mkt-delay-4"
              : "mkt-delay-5";
  return (
    <div className={`mkt-fade-up ${delayClass} ${className}`.trim()}>{children}</div>
  );
}

/** Soft ambient background for marketing pages. */
export function AmbientBackdrop({ variant = "light" }: { variant?: "light" | "navy" }) {
  if (variant === "navy") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="mkt-orb absolute -left-20 top-0 h-64 w-64 rounded-full bg-teal/40" />
        <div
          className="mkt-orb absolute -right-10 bottom-0 h-72 w-72 rounded-full bg-white/15"
          style={{ animationDelay: "1.2s" }}
        />
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="mkt-grid absolute inset-0 opacity-50" />
      <div className="mkt-orb absolute -left-24 top-0 h-64 w-64 rounded-full bg-teal/20" />
      <div
        className="mkt-orb absolute -right-16 top-24 h-72 w-72 rounded-full bg-navy/10"
        style={{ animationDelay: "1.4s" }}
      />
    </div>
  );
}

/** Card with hover lift — marketing + app. */
export function MotionCard({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "section";
}) {
  return (
    <Tag className={`mkt-card-lift rounded-2xl border border-border bg-white shadow-sm ${className}`}>
      {children}
    </Tag>
  );
}

/** Subtle page content wrapper for app routes. */
export function AppPageMotion({ children }: { children: ReactNode }) {
  return <div className="app-page-enter space-y-6">{children}</div>;
}
