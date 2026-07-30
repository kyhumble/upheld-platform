import Link from "next/link";
import { MarketingHeader } from "@/components/marketing-header";
import { Card, CardHeader } from "@/components/ui";
import {
  CMS_NATIONAL_30_DAY_PERIOD_PAYMENT,
  CMS_PAYMENT_YEAR,
  CMS_PER_VISIT_RATES_2026,
  CMS_LUPA_ILLUSTRATIVE_GAP,
} from "@/domain/chart-scan/knowledge";
import { FAMILY_BASE_WEIGHT } from "@/domain/chart-scan/pdgm-payment";
import { READINESS_GATE } from "@/domain/chart-scan/readiness-path";
import { formatCurrency } from "@/lib/utils";
import { AmbientBackdrop, PageEnter, Reveal } from "@/components/site-motion";

export const metadata = {
  title: "How Upheld calculates scores and dollars",
  description:
    "Readiness, expected period payment, capture, and protect — transparent calculation methods for Clinical Revenue Integrity.",
};

export default function CalculationsPage() {
  return (
    <div className="relative min-h-screen bg-surface">
      <MarketingHeader />

      <div className="relative overflow-hidden">
        <AmbientBackdrop />
        <main className="relative mx-auto max-w-3xl space-y-6 px-4 py-10">
        <PageEnter>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
            Methodology
          </p>
          <h1 className="mt-2 font-display text-3xl text-navy">
            How Upheld calculates scores and dollars
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Transparent formulas for agency QA and revenue leaders. All dollar figures are{" "}
            <strong className="text-navy">advisory</strong> — not a certified CMS HIPPS grouper or
            remittance. Full technical detail also lives in the repo at{" "}
            <code className="text-xs">docs/calculations.md</code>.
          </p>
        </div>
        </PageEnter>

        <Reveal>
        <Card hover>
          <CardHeader title="1 · What each number means" />
          <ul className="space-y-2 px-5 py-4 text-sm text-muted">
            <li>
              <strong className="text-navy">Submission readiness (0–100)</strong> — how clean the
              packet looks for submission (integrity, not payment).
            </li>
            <li>
              <strong className="text-navy">Expected period total</strong> — advisory full{" "}
              <em>30-day PDGM period</em> pay for this chart (national base × case-mix weight × wage
              index).
            </li>
            <li>
              <strong className="text-ok">Capture</strong> — upside if documentation/coding is fixed.
            </li>
            <li>
              <strong className="text-danger">Protect</strong> — exposure if submitted as-is.
            </li>
            <li>
              <strong className="text-navy">Path to {READINESS_GATE}+</strong> — ordered open findings
              that drag readiness under the gate.
            </li>
          </ul>
        </Card>
        </Reveal>

        <Reveal delayMs={40}>
        <Card hover>
          <CardHeader title="2 · CMS rate anchors (CY 2026)" />
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
            <div className="mkt-card-lift rounded-lg border border-border bg-paper p-3">
              <p className="text-[11px] font-semibold uppercase text-muted">30-day national base</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-navy">
                {formatCurrency(CMS_NATIONAL_30_DAY_PERIOD_PAYMENT)}
              </p>
            </div>
            <div className="mkt-card-lift rounded-lg border border-border bg-paper p-3">
              <p className="text-[11px] font-semibold uppercase text-muted">SN per-visit</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-navy">
                {formatCurrency(CMS_PER_VISIT_RATES_2026.skilledNursing)}
              </p>
            </div>
            <div className="mkt-card-lift rounded-lg border border-border bg-paper p-3">
              <p className="text-[11px] font-semibold uppercase text-muted">Illustrative LUPA gap</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-danger">
                {formatCurrency(CMS_LUPA_ILLUSTRATIVE_GAP)}
              </p>
            </div>
          </div>
          <p className="border-t border-border px-5 py-3 text-xs text-muted">
            A certification period is often 60 days and may include <strong>two</strong> 30-day
            payments. Upheld models one PDGM payment period at a time.
          </p>
        </Card>
        </Reveal>

        <Reveal delayMs={60}>
        <Card hover>
          <CardHeader title="3 · Expected period payment" />
          <div className="space-y-3 px-5 py-4 text-sm text-muted">
            <p className="rounded-lg bg-mist px-3 py-2 font-mono text-xs text-navy">
              Expected $ = National base × Case-mix weight × Wage index
            </p>
            <p>
              <strong className="text-navy">National base</strong> ={" "}
              {formatCurrency(CMS_NATIONAL_30_DAY_PERIOD_PAYMENT)} (CMS CY {CMS_PAYMENT_YEAR}).
            </p>
            <p>
              <strong className="text-navy">Case-mix weight</strong> is inferred from the packet
              (clinical group family, comorbidity, function, timing, admission). If a known HIPPS
              code is present, a sparse weight table is preferred.
            </p>
            <p>
              <strong className="text-navy">Wage index</strong> defaults to 1.0 (national). Agencies
              can set a local wage index in Settings.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-2 font-semibold">Clinical group family</th>
                    <th className="py-2 font-semibold">Relative base weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries(FAMILY_BASE_WEIGHT).map(([k, v]) => (
                    <tr key={k}>
                      <td className="py-1.5 font-medium text-navy">{k}</td>
                      <td className="py-1.5 tabular-nums">{v.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs">
              Then multiplied by comorbidity (none/low/high), functional band, early/late timing, and
              community vs institutional admission factors. Weight is clamped (~0.55–2.8).
            </p>
          </div>
        </Card>
        </Reveal>

        <Reveal delayMs={80}>
        <Card hover>
          <CardHeader title="4 · Capture and protect" />
          <div className="space-y-2 px-5 py-4 text-sm text-muted">
            <p>
              Each finding has an advisory $ (from CMS-scaled rules) and type{" "}
              <strong className="text-ok">RECOVERY</strong> (capture) or{" "}
              <strong className="text-danger">EXPOSURE</strong> (protect).
            </p>
            <p>
              Finding $ is scaled to the chart’s expected period:{" "}
              <code className="text-xs">nationalFinding$ × (E / $2,038.22)</code>, then capped at E.
            </p>
            <p>
              <strong className="text-navy">Protect:</strong> denial-class findings (F2F, homebound,
              cert, orders) take the <em>maximum once</em>; other exposure is summed; result ≤ E.
            </p>
            <p>
              <strong className="text-navy">Capture:</strong> recovery findings are summed and capped
              at E. Capture and protect are <em>separate paths</em> — do not add them as a new claim
              total.
            </p>
          </div>
        </Card>
        </Reveal>

        <Reveal delayMs={100}>
        <Card hover>
          <CardHeader title="5 · Submission readiness" />
          <div className="space-y-2 px-5 py-4 text-sm text-muted">
            <p>
              Severity penalties: Critical 22 · High 12 · Medium 6 · Low 2. Each module score =
              100 − sum(penalties), or 92 if no findings.
            </p>
            <p className="rounded-lg bg-mist px-3 py-2 font-mono text-xs text-navy">
              Readiness = 0.35×Clinical + 0.40×Compliance + 0.25×Revenue
            </p>
            <p>
              Gate for the fix path: <strong className="text-navy">{READINESS_GATE}</strong>. Live
              readiness uses <strong>OPEN</strong> findings only (resolved/dismissed no longer
              penalize).
            </p>
          </div>
        </Card>
        </Reveal>

        <Reveal delayMs={120}>
        <Card hover>
          <CardHeader title="6 · What this is not" />
          <ul className="list-disc space-y-1 px-5 py-4 pl-10 text-sm text-muted">
            <li>Not a certified CMS HIPPS grouper</li>
            <li>Not a remittance or payment guarantee</li>
            <li>Not full CMS weight files (sparse HIPPS table + signal model today)</li>
            <li>Not a substitute for human clinical/compliance judgment</li>
          </ul>
        </Card>
        </Reveal>

        <Reveal>
        <div className="flex flex-wrap justify-center gap-3 pb-8">
          <Link
            href="/scan"
            className="mkt-btn-glow rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white"
          >
            Run Free Chart Scan
          </Link>
          <Link
            href="/trust"
            className="rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-semibold text-navy transition hover:-translate-y-0.5 hover:bg-mist"
          >
            Trust & compliance
          </Link>
        </div>
        </Reveal>
      </main>
      </div>
    </div>
  );
}
