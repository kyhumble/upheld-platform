import Link from "next/link";
import { retrieveCheckoutSession } from "@/lib/stripe";
import { Logo } from "@/components/logo";

export const metadata = {
  title: "Pilot confirmed · Upheld",
};

export default async function PilotSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const session = sessionId ? await retrieveCheckoutSession(sessionId) : null;
  const paid = session?.payment_status === "paid";

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link href="/">
            <Logo size={28} subtitle="Pilot" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
          30-day pilot
        </p>
        <h1 className="mt-3 font-display text-3xl text-navy">
          {paid ? "Payment received — welcome aboard" : "Thanks for starting a pilot"}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted">
          {paid
            ? "We'll email you within one business day to align on success metrics, episode volume, BAA if PHI is in scope, and workflow. Free Chart Scan remains your proof engine during setup."
            : "If you completed checkout, Stripe will confirm payment shortly. We'll follow up at your email. Questions: ky@getupheld.com."}
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/scan"
            className="rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white"
          >
            Run another Free Chart Scan
          </Link>
          <Link
            href="/sign-in"
            className="rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-semibold text-navy"
          >
            Open agency workspace
          </Link>
        </div>
      </main>
    </div>
  );
}
