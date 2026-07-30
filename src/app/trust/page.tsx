import Link from "next/link";
import { MarketingHeader } from "@/components/marketing-header";
import { CmsRateCard } from "@/components/cms-rate-card";
import { Card, CardHeader } from "@/components/ui";
import { AmbientBackdrop, PageEnter, Reveal } from "@/components/site-motion";
import { PublicPilotForm } from "@/components/public-pilot-form";
import { CONTACT_EMAIL, contactMailto } from "@/lib/contact";

export const metadata = {
  title: "Trust & compliance · Upheld",
  description: "How Upheld handles Clinical Revenue Integrity, PHI, and CMS rate anchors.",
};

export default function TrustPage() {
  return (
    <div className="relative min-h-screen bg-surface">
      <MarketingHeader />
      <div className="relative overflow-hidden">
        <AmbientBackdrop />
        <main className="relative mx-auto max-w-3xl space-y-6 px-4 py-10">
          <PageEnter>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">Trust</p>
              <h1 className="mt-2 font-display text-3xl text-navy">
                How Upheld is designed to operate
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Clinical Revenue Integrity is not coding theater and not a CMS grouper. Every finding
                is advisory until a clinician or QA owner acts.
              </p>
            </div>
          </PageEnter>

          {[
            {
              title: "Human-in-the-loop",
              body: (
                <>
                  <p>AI surfaces and prioritizes. Clinicians and QA accept, dismiss, or correct.</p>
                  <p>Findings never auto-write to an EMR or claim system in Free Chart Scan.</p>
                </>
              ),
            },
            {
              title: "PHI & BAA",
              body: (
                <>
                  <p>
                    Prefer de-identified or synthetic packets for Free Chart Scan until a Business
                    Associate Agreement is signed.
                  </p>
                  <p>
                    Free scan retention is time-limited. Agency settings track BAA posture (none /
                    pending / signed).
                  </p>
                  <p>
                    We do not train base models on customer PHI without explicit, documented consent.
                  </p>
                </>
              ),
            },
            {
              title: "Capture vs protect dollars",
              body: (
                <>
                  <p>
                    <strong className="text-ok">Capture</strong> — potential revenue if documentation
                    supports additional coding/comorbidity accuracy (not upcoding beyond the record).
                  </p>
                  <p>
                    <strong className="text-danger">Protect</strong> — exposure if the chart is
                    submitted with denial, LUPA, or compliance gaps.
                  </p>
                  <p>Both are advisory estimates anchored to CMS national standardized rates.</p>
                </>
              ),
            },
          ].map((block, i) => (
            <Reveal key={block.title} delayMs={i * 60}>
              <Card hover>
                <CardHeader title={block.title} />
                <div className="space-y-2 px-5 py-4 text-sm leading-relaxed text-muted">
                  {block.body}
                </div>
              </Card>
            </Reveal>
          ))}

          <Reveal delayMs={80}>
            <CmsRateCard />
          </Reveal>

          {[
            {
              title: "Abuse controls & retention",
              body: (
                <>
                  <p>
                    Free Chart Scans are rate-limited per email, network, and agency to prevent
                    abuse.
                  </p>
                  <p>
                    Free scans expire after a configurable retention window and can be purged via
                    scheduled job (expired FREE type only — pilot/full history is retained).
                  </p>
                </>
              ),
            },
            {
              title: "Encryption & infrastructure",
              body: (
                <>
                  <p>
                    Chart text and evidence excerpts can be encrypted at rest (AES-256-GCM) when
                    field encryption is enabled in the environment.
                  </p>
                  <p>
                    Hosting: <strong className="text-navy">Vercel</strong> · Database:{" "}
                    <strong className="text-navy">Neon Postgres</strong> · Email:{" "}
                    <strong className="text-navy">Resend</strong> · OCR (scanned PDFs):{" "}
                    <strong className="text-navy">Azure Document Intelligence</strong>. Complete
                    BAAs with each subprocessor before identifiable PHI production use.
                  </p>
                  <p>
                    Paid pilot checkout (Stripe) is optional and currently deferred — pilot interest
                    is collected by form and email only.
                  </p>
                  <p>
                    Live platform status:{" "}
                    <Link href="/status" className="font-semibold text-teal hover:underline">
                      /status
                    </Link>
                    . How scores and dollars are computed:{" "}
                    <Link href="/calculations" className="font-semibold text-teal hover:underline">
                      /calculations
                    </Link>
                    .
                  </p>
                </>
              ),
            },
            {
              title: "What we are not",
              body: (
                <ul className="list-disc space-y-1 pl-5">
                  <li>Not an EMR or system of record</li>
                  <li>Not a certified CMS HIPPS grouper</li>
                  <li>Not outsourced coding that replaces clinical judgment</li>
                  <li>Not “QA software” theater disconnected from dollars</li>
                </ul>
              ),
            },
          ].map((block, i) => (
            <Reveal key={block.title} delayMs={i * 50}>
              <Card hover>
                <CardHeader title={block.title} />
                <div className="space-y-2 px-5 py-4 text-sm leading-relaxed text-muted">
                  {block.body}
                </div>
              </Card>
            </Reveal>
          ))}

          <Reveal>
            <PublicPilotForm source="trust_page" />
          </Reveal>

          <Reveal>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link
                href="/scan"
                className="mkt-btn-glow rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white"
              >
                Run Free Chart Scan
              </Link>
              <Link
                href="/pilot"
                className="rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-semibold text-navy transition hover:-translate-y-0.5 hover:bg-mist"
              >
                Request pilot
              </Link>
            </div>
            <p className="mt-4 text-center text-xs text-muted">
              Questions:{" "}
              <a className="font-medium text-teal" href={contactMailto()}>
                {CONTACT_EMAIL}
              </a>
            </p>
          </Reveal>
        </main>
      </div>
    </div>
  );
}
