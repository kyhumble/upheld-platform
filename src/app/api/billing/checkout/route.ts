import { NextResponse } from "next/server";
import { z } from "zod";
import { createPilotLead } from "@/lib/pilot-leads";
import { createPilotCheckoutSession, isStripePilotEnabled } from "@/lib/stripe";
import { writeAudit } from "@/lib/audit";
import { getValidSession } from "@/lib/auth";

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional().nullable(),
  agencyName: z.string().max(200).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  scanToken: z.string().max(64).optional().nullable(),
  source: z.string().max(80).optional(),
});

/**
 * POST /api/billing/checkout
 * Creates Stripe Checkout for 30-day pilot. Falls back 503 if Stripe not configured.
 */
export async function POST(req: Request) {
  if (!isStripePilotEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Stripe pilot checkout not configured. Request interest instead or set STRIPE_* env.",
      },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid email or payload" }, { status: 400 });
  }

  const session = await getValidSession();
  const { email, name, agencyName, note, scanToken, source } = parsed.data;

  const lead = await createPilotLead({
    email,
    name: name ?? session?.name,
    agencyName: agencyName ?? session?.agencyName,
    note,
    source: source ?? "stripe_checkout",
    scanToken,
    agencyId: session?.agencyId,
  });

  const checkout = await createPilotCheckoutSession({
    customerEmail: email,
    customerName: name ?? session?.name,
    agencyName: agencyName ?? session?.agencyName,
    leadId: lead.id,
    agencyId: session?.agencyId,
    scanToken,
  });

  if (!checkout.ok) {
    return NextResponse.json({ ok: false, error: checkout.error }, { status: 502 });
  }

  await writeAudit({
    agencyId: session?.agencyId,
    userId: session?.userId,
    action: "pilot.checkout_started",
    entityType: "PilotLead",
    entityId: lead.id,
    meta: { sessionId: checkout.sessionId, email, scanToken },
  });

  return NextResponse.json({
    ok: true,
    url: checkout.url,
    sessionId: checkout.sessionId,
    leadId: lead.id,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    enabled: isStripePilotEnabled(),
    product: "upheld_pilot_30d",
  });
}
