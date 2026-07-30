/**
 * Report + conversion email delivery.
 * - Without RESEND_API_KEY: logs payload (dev) and returns simulated success.
 * - With RESEND_API_KEY: sends via Resend HTTP API.
 */

import {
  CMS_NATIONAL_30_DAY_PERIOD_PAYMENT,
  CMS_PAYMENT_YEAR,
} from "@/domain/chart-scan/knowledge";
import { CONTACT_EMAIL } from "@/lib/contact";

export type EmailResult = {
  ok: boolean;
  mode: "resend" | "log";
  id?: string;
  error?: string;
};

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

export function buildScanReportEmail(params: {
  to: string;
  contactName?: string | null;
  agencyName?: string | null;
  publicToken: string;
  readinessScore: number | null;
  revenueAtRisk: number | null;
  revenueUpside?: number | null;
  criticalCount: number;
  highCount: number;
}): { subject: string; text: string; html: string } {
  const reportUrl = `${appUrl()}/scan/${params.publicToken}`;
  const name = params.contactName?.trim() || "there";
  const agency = params.agencyName?.trim() || "your agency";
  const readiness = params.readinessScore ?? "—";
  const protect = money(params.revenueAtRisk);
  const capture = money(params.revenueUpside);
  const periodTotal = money(CMS_NATIONAL_30_DAY_PERIOD_PAYMENT);

  const subject = `Upheld Chart Scan · Readiness ${readiness}/100 · Period ${periodTotal} · Capture ${capture} · Protect ${protect}`;
  const text = `Hi ${name},

Your Free Chart Scan is ready.

Agency: ${agency}
Submission Readiness: ${readiness}/100
Expected 30-day period total (CMS CY ${CMS_PAYMENT_YEAR} national base): ${periodTotal}
  (before case-mix × wage index; cert period may span two 30-day payments)
Recoverable if fixed (capture): ${capture}
At risk if submitted (protect): ${protect}
Critical: ${params.criticalCount} · High: ${params.highCount}

Open your interactive report:
${reportUrl}

Findings require human review before claim submission.
This is Clinical Revenue Integrity — not a CMS grouper.

Ready for every episode before submission? Reply or request a pilot from the report.

— Upheld · Humble Haus Ventures
${CONTACT_EMAIL}
`;

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;color:#142033">
    <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#07B4A6;font-weight:600">Upheld · Free Chart Scan</p>
    <h1 style="font-size:22px;color:#052355;margin:8px 0 16px">Your chart scan report is ready</h1>
    <p>Hi ${escapeHtml(name)},</p>
    <p>We finished the multi-pass Clinical Revenue Integrity review for <strong>${escapeHtml(agency)}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      <tr>
        <td style="padding:12px;border:1px solid #e2e8ee;background:#fbfbfc;width:25%">
          <div style="font-size:11px;color:#5a6a7a;text-transform:uppercase">Readiness</div>
          <div style="font-size:20px;font-weight:700;color:#052355">${readiness}<span style="font-size:12px;font-weight:500;color:#5a6a7a">/100</span></div>
        </td>
        <td style="padding:12px;border:1px solid #e2e8ee;background:#f0f4f8;width:25%">
          <div style="font-size:11px;color:#052355;text-transform:uppercase">Expected period</div>
          <div style="font-size:20px;font-weight:700;color:#052355">${periodTotal}</div>
          <div style="font-size:10px;color:#5a6a7a">CMS 30-day base</div>
        </td>
        <td style="padding:12px;border:1px solid #e2e8ee;background:#ecfdf5;width:25%">
          <div style="font-size:11px;color:#047857;text-transform:uppercase">Capture</div>
          <div style="font-size:20px;font-weight:700;color:#047857">${capture}</div>
          <div style="font-size:10px;color:#5a6a7a">if fixed</div>
        </td>
        <td style="padding:12px;border:1px solid #e2e8ee;background:#fef2f2;width:25%">
          <div style="font-size:11px;color:#b42318;text-transform:uppercase">Protect</div>
          <div style="font-size:20px;font-weight:700;color:#b42318">${protect}</div>
          <div style="font-size:10px;color:#5a6a7a">if submitted as-is</div>
        </td>
      </tr>
      <tr>
        <td style="padding:12px;border:1px solid #e2e8ee" colspan="4">
          Critical: <strong>${params.criticalCount}</strong> · High: <strong>${params.highCount}</strong>
          · Period total is national standardized 30-day base before case-mix/wage
        </td>
      </tr>
    </table>
    <p><a href="${reportUrl}" style="display:inline-block;background:#052355;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Open interactive report</a></p>
    <p style="font-size:13px;margin-top:20px">Want this on every episode before claim submission? Request a 30-day pilot from the report or email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
    <p style="font-size:12px;color:#5a6a7a;margin-top:28px">Human review required. Not a CMS HIPPS grouper. PHI production use requires a BAA.</p>
  </div>`;

  return { subject, text, html };
}

export function buildPilotConfirmationEmail(params: {
  to: string;
  contactName?: string | null;
  agencyName?: string | null;
  note?: string | null;
  reportUrl?: string | null;
  readinessScore?: number | null;
  revenueAtRisk?: number | null;
  revenueUpside?: number | null;
}): { subject: string; text: string; html: string } {
  const name = params.contactName?.trim() || "there";
  const agency = params.agencyName?.trim() || "your agency";
  const subject = `Upheld pilot request received · ${agency}`;
  const text = `Hi ${name},

Thanks for requesting a 30-day Upheld pilot for ${agency}.

We'll follow up shortly at this email to align on:
- Success metric for the pilot window
- Volume (episodes / week)
- BAA if identifiable PHI is in scope
- EMR / workflow fit (file upload first)

${params.reportUrl ? `Your Free Chart Scan proof: ${params.reportUrl}\n` : ""}
Questions? Reply or write ${CONTACT_EMAIL}.

— Upheld · Humble Haus Ventures
`;

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;color:#142033">
    <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#07B4A6;font-weight:600">Upheld · Pilot</p>
    <h1 style="font-size:22px;color:#052355;margin:8px 0 16px">Pilot request received</h1>
    <p>Hi ${escapeHtml(name)},</p>
    <p>Thanks for requesting a 30-day pilot for <strong>${escapeHtml(agency)}</strong>.</p>
    <p>We'll follow up to align on success metric, episode volume, BAA (if PHI), and workflow fit.</p>
    ${
      params.reportUrl
        ? `<p><a href="${params.reportUrl}" style="display:inline-block;background:#052355;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Re-open your proof report</a></p>`
        : ""
    }
    <p style="font-size:12px;color:#5a6a7a;margin-top:28px">${CONTACT_EMAIL} · Humble Haus Ventures</p>
  </div>`;

  return { subject, text, html };
}

export function buildPilotLeadNotifyEmail(params: {
  contactName?: string | null;
  contactEmail: string;
  agencyName?: string | null;
  note?: string | null;
  scanToken?: string | null;
  readinessScore?: number | null;
  revenueAtRisk?: number | null;
  revenueUpside?: number | null;
  source: string;
}): { subject: string; text: string; html: string } {
  const agency = params.agencyName?.trim() || "(no agency)";
  const reportUrl = params.scanToken ? `${appUrl()}/scan/${params.scanToken}` : null;
  const subject = `[Pilot lead] ${agency} · ${params.contactEmail}`;
  const text = `New Upheld pilot interest

Source: ${params.source}
Name: ${params.contactName ?? "—"}
Email: ${params.contactEmail}
Agency: ${agency}
Note: ${params.note || "—"}
Readiness: ${params.readinessScore ?? "—"}
Capture: ${money(params.revenueUpside)}
Protect: ${money(params.revenueAtRisk)}
Report: ${reportUrl ?? "—"}
`;

  const html = `<pre style="font-family:ui-monospace,monospace;font-size:13px;white-space:pre-wrap">${escapeHtml(text)}</pre>`;
  return { subject, text, html };
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Upheld <onboarding@resend.dev>";

  if (!apiKey) {
    console.info("[email:log]", {
      to: params.to,
      subject: params.subject,
      preview: params.text.slice(0, 320),
    });
    return { ok: true, mode: "log", id: `log_${Date.now()}` };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, mode: "resend", error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, mode: "resend", id: data.id };
  } catch (e) {
    return {
      ok: false,
      mode: "resend",
      error: e instanceof Error ? e.message : "send failed",
    };
  }
}

/** Notify internal ops of pilot leads (PILOT_NOTIFY_EMAIL or EMAIL_FROM mailbox). */
export async function notifyPilotLead(params: {
  contactName?: string | null;
  contactEmail: string;
  agencyName?: string | null;
  note?: string | null;
  scanToken?: string | null;
  readinessScore?: number | null;
  revenueAtRisk?: number | null;
  revenueUpside?: number | null;
  source: string;
}): Promise<EmailResult> {
  // Always notify ops at PILOT_NOTIFY_EMAIL (prod: ky@getupheld.com) or CONTACT_EMAIL
  const to =
    process.env.PILOT_NOTIFY_EMAIL?.trim() ||
    process.env.OPS_EMAIL?.trim() ||
    CONTACT_EMAIL;
  const payload = buildPilotLeadNotifyEmail(params);
  const result = await sendEmail({
    to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    replyTo: params.contactEmail,
  });
  if (!result.ok) {
    console.error("[pilot-notify] failed", { to, error: result.error });
  } else {
    console.info("[pilot-notify] sent", { to, mode: result.mode, id: result.id });
  }
  return result;
}
