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

export type FieldNurseFindingLine = {
  severity: string;
  module: string;
  title: string;
  suggestedCorrection: string;
  impactType?: string | null;
  estimatedImpact?: number | null;
  category?: string | null;
};

/** QA → field nurse correction handoff */
export function buildFieldNurseHandoffEmail(params: {
  nurseName?: string | null;
  nurseEmail: string;
  qaName?: string | null;
  qaEmail?: string | null;
  agencyName?: string | null;
  patientLabel?: string | null;
  clinicianHint?: string | null;
  readinessScore?: number | null;
  note?: string | null;
  reportUrl: string;
  findings: FieldNurseFindingLine[];
}): { subject: string; text: string; html: string } {
  const nurse = params.nurseName?.trim() || "there";
  const episode = params.patientLabel?.trim() || "episode packet";
  const agency = params.agencyName?.trim() || "your agency";
  const qa = params.qaName?.trim() || "QA";
  const subject = `Chart corrections needed · ${episode} · ${agency}`;

  const lines = params.findings.map((f, i) => {
    const moneyBit =
      f.estimatedImpact != null && f.estimatedImpact > 0
        ? ` · ${f.impactType === "RECOVERY" ? "Capture" : "Protect"} ${money(f.estimatedImpact)}`
        : "";
    return `${i + 1}. [${f.severity}] ${f.title}${moneyBit}
   Fix: ${f.suggestedCorrection}`;
  });

  const text = `Hi ${nurse},

${qa} reviewed a Clinical Revenue Integrity scan and needs documentation corrections before submission.

Episode: ${episode}
${params.clinicianHint ? `Clinician: ${params.clinicianHint}\n` : ""}Agency: ${agency}
Readiness: ${params.readinessScore != null ? `${params.readinessScore}/100` : "—"}
Open findings to correct: ${params.findings.length}

${params.note?.trim() ? `Note from QA:\n${params.note.trim()}\n\n` : ""}Priority corrections:
${lines.join("\n\n")}

Open the full report (with all findings and evidence):
${params.reportUrl}

When fixes are in the chart, reply to this email or notify QA so they can re-review and mark items resolved.

— Upheld · Clinical Revenue Integrity
Questions for Upheld: ${CONTACT_EMAIL}
`;

  const findingHtml = params.findings
    .map((f, i) => {
      const moneyBit =
        f.estimatedImpact != null && f.estimatedImpact > 0
          ? ` · <strong>${f.impactType === "RECOVERY" ? "Capture" : "Protect"} ${money(f.estimatedImpact)}</strong>`
          : "";
      return `<div style="border:1px solid #e2e8ee;border-radius:10px;padding:14px 16px;margin:0 0 12px;background:#fff">
  <p style="margin:0 0 6px;font-size:12px;color:#5a6a7a"><strong style="color:#052355">#${i + 1}</strong> · ${escapeHtml(f.severity)} · ${escapeHtml(f.module)}${moneyBit}</p>
  <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#052355">${escapeHtml(f.title)}</p>
  <p style="margin:0;font-size:12px;color:#07B4A6;font-weight:600;text-transform:uppercase;letter-spacing:.06em">What to fix</p>
  <p style="margin:4px 0 0;font-size:14px;color:#142033;line-height:1.5">${escapeHtml(f.suggestedCorrection)}</p>
</div>`;
    })
    .join("");

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:600px;color:#142033">
    <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#07B4A6;font-weight:600">Upheld · Field correction request</p>
    <h1 style="font-size:22px;color:#052355;margin:8px 0 16px">Chart corrections needed</h1>
    <p>Hi ${escapeHtml(nurse)},</p>
    <p><strong>${escapeHtml(qa)}</strong> reviewed a Clinical Revenue Integrity scan and needs documentation updates before submission.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
      <tr><td style="padding:8px;border:1px solid #e2e8ee;background:#fbfbfc;color:#5a6a7a">Episode</td><td style="padding:8px;border:1px solid #e2e8ee">${escapeHtml(episode)}</td></tr>
      ${params.clinicianHint ? `<tr><td style="padding:8px;border:1px solid #e2e8ee;background:#fbfbfc;color:#5a6a7a">Clinician</td><td style="padding:8px;border:1px solid #e2e8ee">${escapeHtml(params.clinicianHint)}</td></tr>` : ""}
      <tr><td style="padding:8px;border:1px solid #e2e8ee;background:#fbfbfc;color:#5a6a7a">Agency</td><td style="padding:8px;border:1px solid #e2e8ee">${escapeHtml(agency)}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8ee;background:#fbfbfc;color:#5a6a7a">Readiness</td><td style="padding:8px;border:1px solid #e2e8ee">${params.readinessScore != null ? `${params.readinessScore}/100` : "—"}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8ee;background:#fbfbfc;color:#5a6a7a">Open items</td><td style="padding:8px;border:1px solid #e2e8ee">${params.findings.length}</td></tr>
    </table>
    ${
      params.note?.trim()
        ? `<div style="background:#e6f8f6;border-radius:10px;padding:12px 14px;margin:0 0 16px"><p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#07B4A6;text-transform:uppercase">Note from QA</p><p style="margin:0;font-size:14px">${escapeHtml(params.note.trim())}</p></div>`
        : ""
    }
    <h2 style="font-size:16px;color:#052355;margin:20px 0 12px">Priority corrections</h2>
    ${findingHtml}
    <p style="margin:20px 0"><a href="${params.reportUrl}" style="display:inline-block;background:#052355;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Open full report</a></p>
    <p style="font-size:13px;color:#5a6a7a">When the chart is updated, reply to this email or notify QA so they can re-review and mark items resolved.</p>
    <p style="font-size:12px;color:#5a6a7a;margin-top:28px">${CONTACT_EMAIL} · Humble Haus Ventures</p>
  </div>`;

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
    // Avoid invalid reply_to values that cause Resend to reject the whole send
    const replyTo =
      params.replyTo &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.replyTo) &&
      !params.replyTo.endsWith("@guest.getupheld.com") &&
      !params.replyTo.endsWith("@demo.local")
        ? params.replyTo
        : undefined;

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
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let detail = body.slice(0, 280);
      try {
        const j = JSON.parse(body) as { message?: string };
        if (j.message) detail = j.message;
      } catch {
        /* keep raw */
      }
      // Friendlier common failures
      if (/api key is invalid/i.test(detail)) {
        detail =
          "Email service API key is invalid — update RESEND_API_KEY in Vercel production.";
      } else if (/only send testing emails/i.test(detail) || /verify a domain/i.test(detail)) {
        detail =
          "Resend domain not verified for this From address, or recipient not allowed in test mode.";
      }
      console.error("[email] Resend failed", { status: res.status, detail, to: params.to, from });
      return { ok: false, mode: "resend", error: detail };
    }
    const data = (await res.json()) as { id?: string };
    console.info("[email] Resend sent", { id: data.id, to: params.to });
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
