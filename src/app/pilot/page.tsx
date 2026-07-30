import Link from "next/link";
import { MarketingHeader } from "@/components/marketing-header";
import { PublicPilotForm } from "@/components/public-pilot-form";
import { AmbientBackdrop, PageEnter } from "@/components/site-motion";
import { CONTACT_EMAIL, contactMailto } from "@/lib/contact";

export const metadata = {
  title: "Request a 30-day pilot · Upheld",
  description:
    "Request an Upheld Clinical Revenue Integrity pilot. Submit the form and our team will follow up by email.",
};

export default function PilotPage() {
  return (
    <div className="relative min-h-screen bg-surface">
      <MarketingHeader />
      <div className="relative overflow-hidden">
        <AmbientBackdrop />
        <main className="relative mx-auto max-w-xl px-4 py-12">
          <PageEnter>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">Pilot</p>
            <h1 className="mt-2 font-display text-3xl text-navy">
              Request a 30-day pilot
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Free Chart Scan is the demo. A pilot puts the same integrity pass on ongoing volume
              with a clear success metric. Submit the form — it emails our team at{" "}
              <strong className="text-navy">{CONTACT_EMAIL}</strong> and sends you a confirmation.
            </p>
          </PageEnter>

          <PageEnter delay={1}>
            <div className="mt-8">
              <PublicPilotForm source="pilot_page" />
            </div>
          </PageEnter>

          <PageEnter delay={2}>
            <div className="mt-8 rounded-2xl border border-border bg-white/80 p-5 text-sm text-muted">
              <p className="font-semibold text-navy">What happens next</p>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                <li>You get a confirmation email</li>
                <li>Our team gets your request at {CONTACT_EMAIL}</li>
                <li>We schedule a short call to align on success metrics and volume</li>
              </ol>
              <p className="mt-4">
                Prefer to start with one chart?{" "}
                <Link href="/scan" className="font-semibold text-teal hover:underline">
                  Free Chart Scan
                </Link>
                {" · "}
                <a href={contactMailto("Upheld pilot")} className="font-semibold text-teal hover:underline">
                  Email us
                </a>
              </p>
            </div>
          </PageEnter>
        </main>
      </div>
    </div>
  );
}
