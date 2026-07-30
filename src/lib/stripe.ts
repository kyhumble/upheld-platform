/**
 * Stripe Checkout for 30-day pilot — raw HTTP (no SDK dependency).
 * Without STRIPE_SECRET_KEY / STRIPE_PRICE_ID: checkout disabled (interest-only path).
 */

import { createHmac, timingSafeEqual } from "crypto";

export type StripeCheckoutResult =
  | { ok: true; url: string; sessionId: string }
  | { ok: false; error: string };

export function isStripePilotEnabled(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_PRICE_ID?.trim(),
  );
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function createPilotCheckoutSession(params: {
  customerEmail: string;
  customerName?: string | null;
  agencyName?: string | null;
  leadId?: string | null;
  agencyId?: string | null;
  scanToken?: string | null;
  successPath?: string;
  cancelPath?: string;
}): Promise<StripeCheckoutResult> {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  const priceId = process.env.STRIPE_PRICE_ID?.trim();
  if (!secret || !priceId) {
    return {
      ok: false,
      error: "Stripe pilot checkout is not configured (STRIPE_SECRET_KEY + STRIPE_PRICE_ID).",
    };
  }

  const success =
    params.successPath ??
    `/pilot/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancel = params.cancelPath ?? "/scan";

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `${appUrl()}${success}`);
  body.set("cancel_url", `${appUrl()}${cancel}`);
  body.set("customer_email", params.customerEmail);
  body.set("line_items[0][price]", priceId);
  body.set("line_items[0][quantity]", "1");
  body.set("allow_promotion_codes", "true");
  body.set("billing_address_collection", "required");
  body.set("client_reference_id", params.leadId ?? params.agencyId ?? "guest");
  body.set("metadata[product]", "upheld_pilot_30d");
  body.set("metadata[email]", params.customerEmail);
  if (params.customerName) body.set("metadata[name]", params.customerName.slice(0, 200));
  if (params.agencyName) body.set("metadata[agencyName]", params.agencyName.slice(0, 200));
  if (params.leadId) body.set("metadata[leadId]", params.leadId);
  if (params.agencyId) body.set("metadata[agencyId]", params.agencyId);
  if (params.scanToken) body.set("metadata[scanToken]", params.scanToken);

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const data = (await res.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };
    if (!res.ok || !data.url || !data.id) {
      return {
        ok: false,
        error: data.error?.message ?? `Stripe session failed (${res.status})`,
      };
    }
    return { ok: true, url: data.url, sessionId: data.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Stripe request failed",
    };
  }
}

/** Minimal webhook signature verification (Stripe signed payload). */
export function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  try {
    const parts = Object.fromEntries(
      signatureHeader.split(",").map((p) => {
        const [k, v] = p.split("=");
        return [k, v];
      }),
    ) as { t?: string; v1?: string };
    if (!parts.t || !parts.v1) return false;
    const age = Math.abs(Date.now() / 1000 - Number(parts.t));
    if (!Number.isFinite(age) || age > 300) return false; // 5 min
    const signed = `${parts.t}.${payload}`;
    const expected = createHmac("sha256", secret).update(signed).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(parts.v1, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function retrieveCheckoutSession(sessionId: string): Promise<{
  id: string;
  payment_status?: string;
  customer_email?: string | null;
  metadata?: Record<string, string>;
} | null> {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret || !sessionId) return null;
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    if (!res.ok) return null;
    return (await res.json()) as {
      id: string;
      payment_status?: string;
      customer_email?: string | null;
      metadata?: Record<string, string>;
    };
  } catch {
    return null;
  }
}
