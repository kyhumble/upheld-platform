import Link from "next/link";
import { getSession } from "@/lib/auth";
import { MarketingHeader } from "@/components/marketing-header";
import { ScanForm } from "@/components/scan-form";
import { CmsRateCard } from "@/components/cms-rate-card";
import { AmbientBackdrop, PageEnter, Reveal } from "@/components/site-motion";

export const metadata = {
  title: "Free Chart Scan · Upheld",
  description:
    "Upload one home health episode. Get Submission Readiness Score, revenue-at-risk, and prioritized findings.",
};

export default async function FreeScanPage() {
  const session = await getSession();

  return (
    <div className="relative min-h-screen bg-surface">
      {session ? (
        <header className="border-b border-border bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-navy transition hover:text-teal"
            >
              ← Workspace
            </Link>
            <Link
              href="/scans"
              className="text-sm font-medium text-teal transition hover:underline"
            >
              Scan history
            </Link>
          </div>
        </header>
      ) : (
        <MarketingHeader />
      )}

      <div className="relative overflow-hidden">
        <AmbientBackdrop />
        <main className="relative mx-auto max-w-5xl px-4 py-10">
          <PageEnter>
            <div className="mb-8 max-w-2xl">
              <p className="mb-3 rounded-xl border border-border bg-white/90 px-3 py-2 text-xs text-muted shadow-sm backdrop-blur-sm">
                Prefer de-identified packets. Scanned PDFs use OCR when needed. For history and batch
                proof,{" "}
                <Link href="/sign-up" className="font-semibold text-teal hover:underline">
                  create a free account
                </Link>{" "}
                or{" "}
                <Link href="/sign-in" className="font-semibold text-teal hover:underline">
                  sign in
                </Link>
                .
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
                Free Chart Scan
              </p>
              <h1 className="mt-2 font-display text-3xl text-navy md:text-4xl">
                Capture what you earned. Protect what you bill.
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">
                Multi-pass Clinical · Compliance · Revenue review on one home health episode. You get
                a readiness score, dual dollar paths (capture if fixed / protect if submitted),
                severity ranking, suggested corrections, and CMS references — human review required.
              </p>
              <ul className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-2">
                {[
                  "Synthetic samples — no PHI needed",
                  "De-identified packets preferred until BAA",
                  "PDF / ZIP / paste · optional email report",
                  "CMS CY 2026 national period anchors",
                ].map((t) => (
                  <li
                    key={t}
                    className="mkt-card-lift rounded-xl border border-border bg-white px-3 py-2 shadow-sm"
                  >
                    ✓ {t}
                  </li>
                ))}
              </ul>
            </div>
          </PageEnter>

          <Reveal>
            <div className="mb-6">
              <CmsRateCard compact />
            </div>
          </Reveal>

          <ScanForm
            isAuthenticated={!!session}
            defaultEmail={session?.email}
            defaultName={session?.name}
            defaultAgency={session?.agencyName}
          />
        </main>
      </div>
    </div>
  );
}
