"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CONTACT_EMAIL, contactMailto } from "@/lib/contact";
import { PublicPilotForm } from "@/components/public-pilot-form";

function Reveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
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
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`mkt-reveal ${visible ? "is-visible" : ""} ${className}`}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}

function useCountUp(target: number, active: boolean, durationMs = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, durationMs]);
  return value;
}

function LiveReportMock() {
  const [score, setScore] = useState(42);
  const [phase, setPhase] = useState<"scanning" | "done">("scanning");
  const capture = 326;
  const protect = 1442;

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setScore(55);
      setPhase("done");
      return;
    }

    let n = 38;
    setPhase("scanning");
    const id = window.setInterval(() => {
      n += Math.floor(Math.random() * 6) + 2;
      if (n >= 55) {
        n = 55;
        setScore(n);
        setPhase("done");
        window.clearInterval(id);
        return;
      }
      setScore(n);
    }, 180);
    return () => window.clearInterval(id);
  }, []);

  // Circumference ≈ 2πr with r=44 → ~276
  const offset = 276 - (276 * score) / 100;
  const tone = score >= 70 ? "text-ok" : score >= 50 ? "text-teal" : "text-warn";

  return (
    <div className="mkt-scan-mock relative rounded-2xl border border-border bg-white p-5 shadow-xl shadow-navy/10">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal">
            Live sample report
          </p>
          <p className="mt-0.5 text-sm font-semibold text-navy">Episode readiness review</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            phase === "scanning"
              ? "bg-amber-50 text-warn"
              : "bg-emerald-50 text-ok"
          }`}
        >
          {phase === "scanning" ? "Analyzing…" : "Complete"}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-6">
        <div className="relative mx-auto h-[120px] w-[120px] shrink-0 sm:mx-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#e2e8ee" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke={score >= 70 ? "#027a48" : score >= 50 ? "#07b4a6" : "#b54708"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="276"
              strokeDashoffset={offset}
              className="transition-[stroke-dashoffset] duration-300 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold tabular-nums ${tone}`}>{score}</span>
            <span className="text-[10px] font-medium text-muted">/ 100</span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-border bg-paper px-3 py-2.5">
            <span className="text-xs font-medium text-muted">Capture $</span>
            <span className="text-sm font-bold tabular-nums text-ok">
              {phase === "done" ? `$${capture.toLocaleString()}` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-paper px-3 py-2.5">
            <span className="text-xs font-medium text-muted">Protect $</span>
            <span className="text-sm font-bold tabular-nums text-danger">
              {phase === "done" ? `$${protect.toLocaleString()}` : "—"}
            </span>
          </div>
          <div className="rounded-xl border border-border bg-paper px-3 py-2.5">
            <p className="text-[11px] font-semibold text-navy">Top finding</p>
            <p className="mt-0.5 text-xs text-muted">
              {phase === "done"
                ? "Face-to-face documentation incomplete — high protect exposure"
                : "Running clinical · compliance · revenue passes…"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {["Clinical", "Compliance", "Revenue"].map((m, i) => (
          <span
            key={m}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              phase === "done" || score > 40 + i * 5
                ? "bg-teal-light text-teal"
                : "bg-mist text-muted"
            }`}
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

function MetricStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const readiness = useCountUp(100, active, 1400);
  const base = useCountUp(2038, active, 1600);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setActive(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-sm md:grid-cols-4"
    >
      {[
        { k: `0–${readiness}`, l: "Readiness score" },
        { k: "Capture", l: "Could add if fixed" },
        { k: "Protect", l: "At risk if submitted" },
        { k: `$${base.toLocaleString()}`, l: "CMS CY 2026 30-day base" },
      ].map((s) => (
        <div
          key={s.l}
          className="bg-white px-5 py-6 text-center transition hover:bg-teal-light/40"
        >
          <div className="text-2xl font-semibold tracking-tight text-navy tabular-nums">{s.k}</div>
          <div className="mt-1 text-[12px] font-medium text-muted">{s.l}</div>
        </div>
      ))}
    </div>
  );
}

const MARQUEE = [
  "Face-to-face",
  "Homebound",
  "LUPA risk",
  "Capture $",
  "Protect $",
  "Readiness 0–100",
  "OASIS consistency",
  "Certification",
  "Comorbidity support",
  "Retrospective batch",
];

export function LandingDynamic() {
  const [path, setPath] = useState<"scan" | "agency">("scan");
  const year = new Date().getFullYear();

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mkt-grid absolute inset-0 opacity-70" />
        <div className="mkt-orb pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-teal/25" />
        <div
          className="mkt-orb pointer-events-none absolute -right-16 top-32 h-80 w-80 rounded-full bg-navy/10"
          style={{ animationDelay: "1.5s" }}
        />
        <div className="mkt-orb pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-teal/15" />

        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-14 md:pb-24 md:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-10">
            <div className="text-center lg:text-left">
              <p className="mkt-fade-up mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal shadow-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal" />
                </span>
                Clinical Revenue Integrity
              </p>
              <h1 className="mkt-fade-up mkt-delay-1 font-display text-[2.5rem] leading-[1.1] text-navy md:text-[3.5rem]">
                Capture what you earned.
                <br className="hidden sm:block" /> Protect what you bill.
              </h1>
              <p className="mkt-fade-up mkt-delay-2 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted md:mx-0 md:text-[1.15rem]">
                Clinical Revenue Integrity for home health: every episode gets a readiness score,{" "}
                <span className="font-semibold text-ok">capture $</span> you can still add, and{" "}
                <span className="font-semibold text-danger">protect $</span> at risk — LUPA, takebacks,
                documentation gaps, undercoding. Anchored to CMS period payment. Not another QA
                checklist.
              </p>
              <div className="mkt-fade-up mkt-delay-3 mt-10 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Link
                  href="/scan"
                  className="mkt-btn-glow rounded-lg bg-navy px-6 py-3 text-[14px] font-semibold text-white shadow-sm"
                >
                  Try a free chart scan
                </Link>
                <Link
                  href="/sign-up"
                  className="rounded-lg border border-border bg-white px-6 py-3 text-[14px] font-semibold text-navy shadow-sm transition hover:-translate-y-0.5 hover:bg-mist hover:shadow-md"
                >
                  Create a free account
                </Link>
              </div>
              <p className="mkt-fade-up mkt-delay-4 mt-5 text-[13px] text-muted">
                No credit card · Works with a sample chart or your own de-identified packet · Takes a
                few minutes
              </p>
            </div>

            <div className="mkt-fade-up mkt-delay-3 mkt-float relative">
              <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-teal/20 via-transparent to-navy/10 blur-xl" />
              <LiveReportMock />
              <div className="mkt-float-delay absolute -bottom-4 -left-3 hidden rounded-xl border border-border bg-white px-3 py-2 text-xs shadow-lg sm:block">
                <span className="font-semibold text-danger">Protect</span>{" "}
                <span className="tabular-nums text-navy">$1,442</span>
              </div>
              <div className="mkt-float absolute -right-2 -top-3 hidden rounded-xl border border-border bg-white px-3 py-2 text-xs shadow-lg sm:block">
                <span className="font-semibold text-ok">Capture</span>{" "}
                <span className="tabular-nums text-navy">$326</span>
              </div>
            </div>
          </div>

          <MetricStrip />

          {/* Steps */}
          <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Upload or paste a chart",
                body: "Use our sample, or paste / upload de-identified notes (PDF, ZIP, or text).",
              },
              {
                step: "2",
                title: "We review it automatically",
                body: "Clinical, compliance, and revenue checks run in one pass — no EMR install.",
              },
              {
                step: "3",
                title: "Get a clear report",
                body: "Score, dollar estimates, and a prioritized list of what to fix before submit.",
              },
            ].map((s, i) => (
              <Reveal key={s.step} delayMs={i * 80}>
                <div className="mkt-card-lift h-full rounded-2xl border border-border bg-white p-5 text-left shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
                    Step {s.step}
                  </p>
                  <h2 className="mt-2 text-base font-semibold text-navy">{s.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Marquee */}
      <div className="overflow-hidden border-y border-border bg-navy py-3">
        <div className="mkt-marquee-track gap-8 px-4">
          {[...MARQUEE, ...MARQUEE].map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="shrink-0 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70"
            >
              {item}
              <span className="ml-8 text-teal">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* What you get */}
      <section id="how" className="border-b border-border bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <Reveal>
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-teal">
              What you get
            </p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl text-navy md:text-4xl">
              A report you can actually use
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
              Every Free Chart Scan ends with a plain-language report. You decide what to fix — we
              never change your EMR or claims for you.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                k: "0–100",
                t: "Readiness score",
                d: "How solid the chart looks for submission. Higher is better.",
                accent: "from-teal/15 to-white",
              },
              {
                k: "Capture $",
                t: "Money you might add",
                d: "If documentation is completed or strengthened before you bill.",
                accent: "from-emerald-50 to-white",
              },
              {
                k: "Protect $",
                t: "Money at risk",
                d: "What you could lose to denials, LUPA, takebacks, or weak support.",
                accent: "from-red-50 to-white",
              },
              {
                k: "Fix list",
                t: "What to do next",
                d: "Ranked findings with suggested corrections and CMS references.",
                accent: "from-mist to-white",
              },
            ].map((item, i) => (
              <Reveal key={item.t} delayMs={i * 70}>
                <div
                  className={`mkt-card-lift h-full rounded-2xl border border-border bg-gradient-to-b ${item.accent} p-5`}
                >
                  <p className="text-xl font-semibold tabular-nums text-navy">{item.k}</p>
                  <p className="mt-2 text-sm font-semibold text-navy">{item.t}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{item.d}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delayMs={100}>
            <div className="mt-8 rounded-2xl border border-border bg-paper px-5 py-4 text-sm text-muted">
              Dollar amounts are{" "}
              <strong className="text-navy">estimates</strong> based on CMS national home health
              rates. They help you prioritize work — they are not a remittance or certified payment
              calculator.{" "}
              <Link href="/calculations" className="font-semibold text-teal hover:underline">
                See how we calculate
              </Link>
              .
            </div>
          </Reveal>
        </div>
      </section>

      {/* Paths — interactive toggle */}
      <section id="product" className="bg-paper">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <Reveal>
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-teal">
              How agencies use Upheld
            </p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl text-navy md:text-4xl">
              Start small. Scale when you&apos;re ready.
            </h2>
          </Reveal>

          <Reveal delayMs={60}>
            <div className="mt-8 inline-flex rounded-full border border-border bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setPath("scan")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  path === "scan" ? "bg-navy text-white shadow" : "text-muted hover:text-navy"
                }`}
              >
                Free Chart Scan
              </button>
              <button
                type="button"
                onClick={() => setPath("agency")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  path === "agency" ? "bg-navy text-white shadow" : "text-muted hover:text-navy"
                }`}
              >
                Agency account
              </button>
            </div>
          </Reveal>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <article
              className={`mkt-card-lift rounded-2xl border p-6 shadow-sm transition ${
                path === "scan"
                  ? "border-teal/40 bg-white ring-2 ring-teal/20"
                  : "border-border bg-white/80 opacity-80"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
                Start here
              </p>
              <h3 className="mt-2 text-xl font-semibold text-navy">Free Chart Scan</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Best for first-time visitors. Run one sample chart or one de-identified episode. See
                the report, score, and dollars. No account required for a guest scan (email may be
                used for rate limits and optional report delivery).
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted">
                <li className="flex gap-2">
                  <span className="text-teal">✓</span> Sample charts included
                </li>
                <li className="flex gap-2">
                  <span className="text-teal">✓</span> Upload PDF / ZIP or paste text
                </li>
                <li className="flex gap-2">
                  <span className="text-teal">✓</span> Email yourself the report link
                </li>
              </ul>
              <Link
                href="/scan"
                className="mkt-btn-glow mt-6 inline-flex rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white"
              >
                Run a free scan
              </Link>
            </article>

            <article
              className={`mkt-card-lift rounded-2xl border p-6 shadow-sm transition ${
                path === "agency"
                  ? "border-teal/40 bg-white ring-2 ring-teal/20"
                  : "border-border bg-white/80 opacity-80"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
                Next step
              </p>
              <h3 className="mt-2 text-xl font-semibold text-navy">Agency account</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Create a free account to keep scan history, manage findings, and run a{" "}
                <strong className="text-navy">retrospective batch</strong> — re-check a set of
                claims you already paid, denied, or LUPA&apos;d to see what we would have flagged
                earlier.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted">
                <li className="flex gap-2">
                  <span className="text-teal">✓</span> Save and reopen reports
                </li>
                <li className="flex gap-2">
                  <span className="text-teal">✓</span> Issues worklist for your team
                </li>
                <li className="flex gap-2">
                  <span className="text-teal">✓</span> Batch proof for owners and QA
                </li>
              </ul>
              <Link
                href="/sign-up"
                className="mt-6 inline-flex rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-semibold text-navy shadow-sm transition hover:-translate-y-0.5 hover:bg-mist"
              >
                Create free account
              </Link>
            </article>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="border-t border-border bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <Reveal>
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-teal">
              What we look for
            </p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl text-navy md:text-4xl">
              Clinical, compliance, and revenue — in one place
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
              You stay in control. Upheld highlights risks and opportunities; your clinicians and QA
              decide what to do.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                t: "Clinical documentation",
                d: "Missing pieces, inconsistent assessments, wound and skilled-need support that looks weak on paper.",
              },
              {
                t: "Compliance basics",
                d: "Face-to-face, homebound, signatures, certification timing, and other survey-sensitive gaps.",
              },
              {
                t: "Revenue risk & opportunity",
                d: "LUPA risk, undercoding / comorbidity support, and exposure that could hit payment.",
              },
              {
                t: "Capture vs protect dollars",
                d: "Two money views: what you might still earn if fixed, and what you might lose if you submit as-is.",
              },
              {
                t: "Shareable report",
                d: "Print, share a link, export CSV, or email the report to yourself or a teammate.",
              },
              {
                t: "Works without your EMR",
                d: "Upload first. No integration project required to try the product.",
              },
            ].map((item, i) => (
              <Reveal key={item.t} delayMs={(i % 3) * 60}>
                <div className="mkt-card-lift group h-full rounded-2xl border border-border bg-paper p-6">
                  <div className="mb-3 h-1 w-8 rounded-full bg-teal/40 transition group-hover:w-14 group-hover:bg-teal" />
                  <h3 className="text-[15px] font-semibold text-navy">{item.t}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{item.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Guardrails */}
      <section className="border-t border-border bg-paper">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-2">
            <Reveal>
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-teal">
                Important to know
              </p>
              <h2 className="mt-3 font-display text-3xl text-navy">
                Built for real agencies — with clear limits
              </h2>
              <ul className="mt-6 space-y-3 text-sm leading-relaxed text-muted">
                <li>
                  <strong className="text-navy">Prefer de-identified charts</strong> until a BAA is
                  in place for identifiable PHI.
                </li>
                <li>
                  <strong className="text-navy">Human review is required.</strong> AI suggests; your
                  team decides.
                </li>
                <li>
                  <strong className="text-navy">Not an EMR</strong> and not coding outsourcing.
                </li>
                <li>
                  <strong className="text-navy">Not a CMS payment grouper.</strong> Estimates help
                  prioritization; they do not replace official billing tools.
                </li>
              </ul>
              <p className="mt-6 text-sm text-muted">
                Details:{" "}
                <Link href="/trust" className="font-semibold text-teal hover:underline">
                  Trust
                </Link>
                {" · "}
                <Link href="/calculations" className="font-semibold text-teal hover:underline">
                  How $ is calculated
                </Link>
              </p>
            </Reveal>
            <Reveal delayMs={80}>
              <div className="rounded-2xl border border-border bg-white p-6 shadow-lg shadow-navy/5">
                <h3 className="text-lg font-semibold text-navy">Ready to try it?</h3>
                <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted">
                  <li>
                    Open <strong className="text-navy">Free Chart Scan</strong>
                  </li>
                  <li>Click a sample chart (or upload your own de-identified packet)</li>
                  <li>Read the report — score, capture $, protect $, fix list</li>
                  <li>
                    Optional: <strong className="text-navy">create an account</strong> to save work
                    and run batch analysis later
                  </li>
                </ol>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/scan"
                    className="mkt-btn-glow rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    Try a free chart scan
                  </Link>
                  <Link
                    href="/sign-up"
                    className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-navy transition hover:-translate-y-0.5 hover:bg-mist"
                  >
                    Create free account
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Pilot form */}
      <section id="pilot" className="border-t border-border bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 md:py-20">
          <Reveal>
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-teal">
              Ready for a pilot?
            </p>
            <h2 className="mt-3 font-display text-3xl text-navy md:text-4xl">
              Request a pilot — we email you back
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Submit the form and your request is sent to{" "}
              <strong className="text-navy">{CONTACT_EMAIL}</strong>. You also get a confirmation
              email. No credit card. We follow up to agree on success metrics and volume.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted">
              <li className="flex gap-2">
                <span className="text-teal">✓</span> Free Chart Scan stays the demo
              </li>
              <li className="flex gap-2">
                <span className="text-teal">✓</span> Pilot = ongoing volume + clear win metric
              </li>
              <li className="flex gap-2">
                <span className="text-teal">✓</span> De-identified first; BAA before PHI
              </li>
            </ul>
            <p className="mt-6 text-sm text-muted">
              Or go straight to{" "}
              <Link href="/pilot" className="font-semibold text-teal hover:underline">
                /pilot
              </Link>
              .
            </p>
          </Reveal>
          <Reveal delayMs={80}>
            <PublicPilotForm source="landing_pilot_form" />
          </Reveal>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative overflow-hidden border-t border-border bg-navy">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="mkt-orb absolute -left-20 top-0 h-64 w-64 rounded-full bg-teal" />
          <div className="mkt-orb absolute -right-10 bottom-0 h-72 w-72 rounded-full bg-white/20" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-16 text-center md:py-20">
          <Reveal>
            <h2 className="font-display text-3xl text-white md:text-4xl">
              One chart. A few minutes. Clear next steps.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/70">
              See how Upheld reads a home health episode before you bring a full agency workflow
              online.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/scan"
                className="mkt-btn-glow rounded-lg bg-white px-6 py-3 text-sm font-semibold text-navy"
              >
                Try a free chart scan
              </Link>
              <Link
                href="/pilot"
                className="rounded-lg border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Request a pilot
              </Link>
              <Link
                href="/sign-up"
                className="rounded-lg border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Create free account
              </Link>
            </div>
            <p className="mt-8 text-sm text-white/55">
              Questions?{" "}
              <a
                href={contactMailto("Upheld question")}
                className="font-medium text-white underline"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-border bg-paper py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-[12px] text-muted sm:flex-row">
          <p>© {year} Humble Haus Ventures · Upheld</p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <Link href="/scan" className="hover:text-navy">
              Free scan
            </Link>
            <Link href="/pilot" className="hover:text-navy">
              Request pilot
            </Link>
            <Link href="/sign-up" className="hover:text-navy">
              Create account
            </Link>
            <Link href="/sign-in" className="hover:text-navy">
              Sign in
            </Link>
            <Link href="/calculations" className="hover:text-navy">
              Calculations
            </Link>
            <Link href="/trust" className="hover:text-navy">
              Trust
            </Link>
            <Link href="/status" className="hover:text-navy">
              Status
            </Link>
            <a href={contactMailto()} className="hover:text-navy">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
