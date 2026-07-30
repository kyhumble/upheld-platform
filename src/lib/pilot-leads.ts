import { prisma } from "./db";

export type CreatePilotLeadInput = {
  email: string;
  name?: string | null;
  agencyName?: string | null;
  note?: string | null;
  source: string;
  scanToken?: string | null;
  agencyId?: string | null;
  readinessScore?: number | null;
  revenueAtRisk?: number | null;
  revenueUpside?: number | null;
  meta?: Record<string, unknown>;
};

export async function createPilotLead(input: CreatePilotLeadInput) {
  return prisma.pilotLead.create({
    data: {
      email: input.email.toLowerCase().trim(),
      name: input.name?.trim() || null,
      agencyName: input.agencyName?.trim() || null,
      note: input.note?.slice(0, 2000) || null,
      source: input.source,
      scanToken: input.scanToken || null,
      agencyId: input.agencyId || null,
      readinessScore: input.readinessScore ?? null,
      revenueAtRisk: input.revenueAtRisk ?? null,
      revenueUpside: input.revenueUpside ?? null,
      status: "new",
      metaJson: JSON.stringify(input.meta ?? {}),
    },
  });
}

export async function markPilotLeadPaid(opts: {
  leadId?: string | null;
  sessionId: string;
  email?: string | null;
  agencyId?: string | null;
}) {
  const now = new Date();

  if (opts.leadId) {
    await prisma.pilotLead.updateMany({
      where: { id: opts.leadId },
      data: {
        status: "paid",
        paidAt: now,
        stripeSessionId: opts.sessionId,
      },
    });
  } else if (opts.email) {
    await prisma.pilotLead.updateMany({
      where: { email: opts.email.toLowerCase(), status: { not: "paid" } },
      data: {
        status: "paid",
        paidAt: now,
        stripeSessionId: opts.sessionId,
      },
    });
  }

  if (opts.agencyId) {
    await prisma.agency.update({
      where: { id: opts.agencyId },
      data: {
        planTier: "pilot",
        pilotPaidAt: now,
        pilotCheckoutSessionId: opts.sessionId,
        pilotInterestAt: now,
      },
    });
  }
}
