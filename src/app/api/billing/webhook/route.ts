import { NextResponse } from "next/server";
import { markPilotLeadPaid } from "@/lib/pilot-leads";
import { verifyStripeSignature } from "@/lib/stripe";
import { writeAudit } from "@/lib/audit";
import { notifyPilotLead } from "@/lib/email";

/**
 * Stripe webhook: checkout.session.completed → mark pilot paid.
 * Set STRIPE_WEBHOOK_SECRET in production.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const raw = await req.text();

  if (secret) {
    const sig = req.headers.get("stripe-signature");
    if (!verifyStripeSignature(raw, sig, secret)) {
      return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 400 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Fail closed in prod without webhook secret
    return NextResponse.json(
      { ok: false, error: "STRIPE_WEBHOOK_SECRET not configured" },
      { status: 503 },
    );
  }

  let event: {
    type?: string;
    data?: {
      object?: {
        id?: string;
        payment_status?: string;
        customer_details?: { email?: string | null };
        customer_email?: string | null;
        metadata?: Record<string, string>;
      };
    };
  };

  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    if (session?.id && session.payment_status === "paid") {
      const email =
        session.customer_details?.email ??
        session.customer_email ??
        session.metadata?.email ??
        null;
      await markPilotLeadPaid({
        leadId: session.metadata?.leadId,
        sessionId: session.id,
        email,
        agencyId: session.metadata?.agencyId,
      });
      await writeAudit({
        agencyId: session.metadata?.agencyId,
        action: "pilot.paid",
        entityType: "PilotLead",
        entityId: session.metadata?.leadId,
        meta: {
          sessionId: session.id,
          email,
          scanToken: session.metadata?.scanToken,
        },
      });
      if (email) {
        await notifyPilotLead({
          contactEmail: email,
          contactName: session.metadata?.name,
          agencyName: session.metadata?.agencyName,
          note: "Stripe pilot checkout paid",
          scanToken: session.metadata?.scanToken,
          source: "stripe_webhook_paid",
        }).catch(() => undefined);
      }
    }
  }

  return NextResponse.json({ ok: true, received: true });
}
