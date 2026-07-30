"use client";

import { useState } from "react";
import { Button } from "./ui";

/**
 * Starts Stripe Checkout for 30-day pilot when billing is configured.
 * Falls back silently if /api/billing/checkout returns 503.
 */
export function PilotCheckoutButton({
  email,
  name,
  agencyName,
  scanToken,
  source = "scan_report_pay",
  note,
  className,
  label = "Start paid 30-day pilot",
}: {
  email: string;
  name?: string | null;
  agencyName?: string | null;
  scanToken?: string | null;
  source?: string;
  note?: string | null;
  className?: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    if (!email) {
      setError("Email is required for checkout.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          agencyName,
          scanToken,
          source,
          note,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Checkout unavailable. Use Request pilot instead.");
        setPending(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not reach billing. Try again or email ky@getupheld.com.");
      setPending(false);
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        onClick={startCheckout}
        disabled={pending || !email}
        className="!bg-white !text-navy hover:!bg-white/90"
      >
        {pending ? "Redirecting to checkout…" : label}
      </Button>
      {error ? <p className="mt-2 text-xs text-red-200">{error}</p> : null}
    </div>
  );
}
