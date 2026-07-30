"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getValidSession, canSeeRevenue } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  buildPilotConfirmationEmail,
  notifyPilotLead,
  sendEmail,
} from "@/lib/email";
import { createPilotLead } from "@/lib/pilot-leads";

export type AgencyActionState = { ok?: boolean; error?: string };

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function sendPilotEmails(opts: {
  contactEmail: string;
  contactName?: string | null;
  agencyName?: string | null;
  note?: string | null;
  scanToken?: string | null;
  readinessScore?: number | null;
  revenueAtRisk?: number | null;
  revenueUpside?: number | null;
  source: string;
}) {
  const reportUrl = opts.scanToken ? `${appUrl()}/scan/${opts.scanToken}` : null;
  const confirm = buildPilotConfirmationEmail({
    to: opts.contactEmail,
    contactName: opts.contactName,
    agencyName: opts.agencyName,
    note: opts.note,
    reportUrl,
    readinessScore: opts.readinessScore,
    revenueAtRisk: opts.revenueAtRisk,
    revenueUpside: opts.revenueUpside,
  });
  await sendEmail({
    to: opts.contactEmail,
    subject: confirm.subject,
    text: confirm.text,
    html: confirm.html,
  });
  await notifyPilotLead({
    contactEmail: opts.contactEmail,
    contactName: opts.contactName,
    agencyName: opts.agencyName,
    note: opts.note,
    scanToken: opts.scanToken,
    readinessScore: opts.readinessScore,
    revenueAtRisk: opts.revenueAtRisk,
    revenueUpside: opts.revenueUpside,
    source: opts.source,
  });
}

export async function updateAgencySettingsAction(
  _prev: AgencyActionState,
  formData: FormData,
): Promise<AgencyActionState> {
  const session = await getValidSession();
  if (!session) return { error: "Sign in required. Your session may have expired — sign in again." };
  if (session.role !== "ADMIN" && session.role !== "EXECUTIVE") {
    return { error: "Only Admin or Executive can update agency settings." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const npi = String(formData.get("npi") ?? "").trim() || null;
  const censusRaw = String(formData.get("censusHint") ?? "").trim();
  const censusHint = censusRaw ? Number(censusRaw) : null;
  const wageRaw = String(formData.get("wageIndex") ?? "").trim();
  const wageIndex = wageRaw ? Number(wageRaw) : 1;
  const baaStatus = String(formData.get("baaStatus") ?? "none");
  const billingEmail = String(formData.get("billingEmail") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!name) return { error: "Agency name is required." };
  if (!["none", "pending", "signed"].includes(baaStatus)) {
    return { error: "Invalid BAA status." };
  }
  if (censusHint != null && (!Number.isFinite(censusHint) || censusHint < 0)) {
    return { error: "Census must be a non-negative number." };
  }
  if (!Number.isFinite(wageIndex) || wageIndex < 0.5 || wageIndex > 2) {
    return { error: "Wage index must be between 0.50 and 2.00 (1.00 = national)." };
  }

  await prisma.agency.update({
    where: { id: session.agencyId },
    data: {
      name,
      npi,
      censusHint,
      wageIndex,
      baaStatus,
      billingEmail,
      phone,
    },
  });

  await writeAudit({
    agencyId: session.agencyId,
    userId: session.userId,
    action: "agency.settings_update",
    entityType: "Agency",
    entityId: session.agencyId,
    meta: { baaStatus, npi: !!npi, wageIndex },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function requestPilotAction(
  _prev: AgencyActionState,
  formData: FormData,
): Promise<AgencyActionState> {
  const session = await getValidSession();
  if (!session) return { error: "Sign in required. Your session may have expired — sign in again." };

  const note = String(formData.get("note") ?? "").trim();

  await prisma.agency.update({
    where: { id: session.agencyId },
    data: {
      pilotInterestAt: new Date(),
      pilotInterestNote: note || null,
      planTier: "pilot", // marks interest path; billing still manual
    },
  });

  await writeAudit({
    agencyId: session.agencyId,
    userId: session.userId,
    action: "pilot.interest",
    entityType: "Agency",
    entityId: session.agencyId,
    meta: {
      note: note.slice(0, 500),
      email: session.email,
      agencyName: session.agencyName,
      canSeeRevenue: canSeeRevenue(session.role),
    },
  });

  try {
    await createPilotLead({
      email: session.email,
      name: session.name,
      agencyName: session.agencyName,
      note,
      source: "settings_pilot_cta",
      agencyId: session.agencyId,
    });
    await sendPilotEmails({
      contactEmail: session.email,
      contactName: session.name,
      agencyName: session.agencyName,
      note,
      source: "settings_pilot_cta",
    });
  } catch (e) {
    console.error("pilot lead/email failed", e);
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/pilot");
  return { ok: true };
}

/**
 * Public pilot interest form (landing, /pilot, trust) — no scan required.
 * Notifies PILOT_NOTIFY_EMAIL / ky@getupheld.com and confirms the requester.
 */
export async function requestPublicPilotAction(
  _prev: AgencyActionState,
  formData: FormData,
): Promise<AgencyActionState> {
  formData.set("source", String(formData.get("source") ?? "public_pilot_form"));
  formData.set("token", String(formData.get("token") ?? ""));
  return requestPilotFromScanAction(_prev, formData);
}

/** Public (or guest) pilot CTA from Free Chart Scan report or public forms */
export async function requestPilotFromScanAction(
  _prev: AgencyActionState,
  formData: FormData,
): Promise<AgencyActionState> {
  const session = await getValidSession();
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const agencyName = String(formData.get("agencyName") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const source = String(formData.get("source") ?? "scan_report_cta").trim() || "scan_report_cta";

  if (!email && !session) return { error: "Email is required." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid work email." };
  }

  const scan = token
    ? await prisma.chartScan.findUnique({ where: { publicToken: token } })
    : null;

  if (session) {
    await prisma.agency.update({
      where: { id: session.agencyId },
      data: {
        pilotInterestAt: new Date(),
        pilotInterestNote: note || `From scan ${token || "n/a"}`,
        planTier: "pilot",
      },
    });
  }

  const leadEmail = email || session?.email || "";
  const leadName = name || session?.name || null;
  const leadAgency =
    agencyName || session?.agencyName || scan?.agencyNameHint || null;

  await writeAudit({
    agencyId: session?.agencyId ?? scan?.agencyId,
    userId: session?.userId,
    action: "pilot.interest",
    entityType: scan ? "ChartScan" : "Agency",
    entityId: scan?.id ?? session?.agencyId,
    meta: {
      email: leadEmail,
      name: leadName,
      agencyName: leadAgency,
      note: note.slice(0, 500),
      scanToken: token || null,
      readiness: scan?.readinessScore,
      revenueAtRisk: scan?.revenueAtRisk,
      revenueUpside: scan?.revenueUpside,
      source,
    },
  });

  if (leadEmail) {
    try {
      await createPilotLead({
        email: leadEmail,
        name: leadName,
        agencyName: leadAgency,
        note,
        source,
        scanToken: token || null,
        agencyId: session?.agencyId ?? scan?.agencyId,
        readinessScore: scan?.readinessScore,
        revenueAtRisk: scan?.revenueAtRisk,
        revenueUpside: scan?.revenueUpside,
      });
      await sendPilotEmails({
        contactEmail: leadEmail,
        contactName: leadName,
        agencyName: leadAgency,
        note,
        scanToken: token || null,
        readinessScore: scan?.readinessScore,
        revenueAtRisk: scan?.revenueAtRisk,
        revenueUpside: scan?.revenueUpside,
        source,
      });
    } catch (e) {
      console.error("pilot lead/email failed", e);
      return {
        error:
          "We saved your interest but email delivery failed. Email ky@getupheld.com directly and we'll follow up.",
      };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/pilot");
  return { ok: true };
}
