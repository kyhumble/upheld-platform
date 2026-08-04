"use server";

import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { DocumentType, FindingModule, FindingSeverity } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getValidSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { classifyDocumentText } from "@/domain/chart-scan/classify";
import { extractTextFromUpload } from "@/domain/chart-scan/extract";
import { runChartScanPipeline, type PipelineResult } from "@/domain/chart-scan/pipeline";
import { getSampleChart, type SampleChartId } from "@/domain/chart-scan/sample-chart";
import { buildScanReportEmail, sendEmail } from "@/lib/email";
import { assertFreeScanAllowed } from "@/lib/rate-limit";
import { encryptField } from "@/lib/crypto";
import { readinessFromFindings } from "@/domain/chart-scan/readiness-path";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** After resolve/dismiss, update scan readiness from remaining OPEN findings */
async function recomputeScanScoresFromOpenFindings(scanId: string) {
  const open = await prisma.chartFinding.findMany({
    where: { scanId, status: "OPEN" },
    select: {
      id: true,
      module: true,
      severity: true,
      status: true,
      title: true,
      category: true,
      suggestedCorrection: true,
    },
  });
  const scores = readinessFromFindings(open);
  const all = await prisma.chartFinding.groupBy({
    by: ["severity"],
    where: { scanId, status: "OPEN" },
    _count: true,
  });
  const count = (sev: string) => all.find((r) => r.severity === sev)?._count ?? 0;

  await prisma.chartScan.update({
    where: { id: scanId },
    data: {
      readinessScore: scores.readiness,
      clinicalScore: scores.clinical,
      complianceScore: scores.compliance,
      revenueScore: scores.revenue,
      criticalCount: count("CRITICAL"),
      highCount: count("HIGH"),
      mediumCount: count("MEDIUM"),
      lowCount: count("LOW"),
    },
  });
}

function retentionDays(): number {
  const n = Number(process.env.FREE_SCAN_RETENTION_DAYS ?? 30);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

function expiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + retentionDays());
  return d;
}

async function persistAnalysis(
  scanId: string,
  result: PipelineResult,
  fileName: string,
  text: string,
  extraDocMeta?: Record<string, unknown>,
  parts?: { fileName: string; mimeType: string; text: string }[],
  durationMs?: number,
) {
  if (parts && parts.length > 0) {
    await prisma.chartDocument.createMany({
      data: parts.map((p) => ({
        scanId,
        fileName: p.fileName,
        mimeType: p.mimeType,
        sizeBytes: Buffer.byteLength(p.text, "utf8"),
        documentType: classifyDocumentText(p.fileName, p.text) as DocumentType,
        extractedText: encryptField(p.text),
        metaJson: JSON.stringify({
          ...extraDocMeta,
          documentTypesDetected: result.documentTypesDetected,
          analyzerVersion: result.analyzerVersion,
          encrypted: true,
        }),
      })),
    });
  } else {
    await prisma.chartDocument.create({
      data: {
        scanId,
        fileName,
        mimeType: "text/plain",
        sizeBytes: Buffer.byteLength(text, "utf8"),
        documentType: classifyDocumentText(fileName, text) as DocumentType,
        extractedText: encryptField(text),
        metaJson: JSON.stringify({
          ...extraDocMeta,
          documentTypesDetected: result.documentTypesDetected,
          analyzerVersion: result.analyzerVersion,
          lupa: result.meta.lupa,
          llm: result.meta.llm,
          encrypted: true,
        }),
      },
    });
  }

  if (result.findings.length > 0) {
    await prisma.chartFinding.createMany({
      data: result.findings.map((f, i) => ({
        scanId,
        module: f.module as FindingModule,
        category: f.category,
        severity: f.severity as FindingSeverity,
        title: f.title,
        description: f.description,
        suggestedCorrection: f.suggestedCorrection,
        cmsReference: f.cmsReference,
        estimatedImpact: f.estimatedImpact,
        impactType: f.impactType,
        // Evidence can include PHI snippets — encrypt at rest
        evidenceExcerpt: f.evidenceExcerpt ? encryptField(f.evidenceExcerpt) : null,
        sortOrder: i,
      })),
    });
  }

  await prisma.chartScan.update({
    where: { id: scanId },
    data: {
      status: "COMPLETE",
      readinessScore: result.scores.readiness,
      clinicalScore: result.scores.clinical,
      complianceScore: result.scores.compliance,
      revenueScore: result.scores.revenue,
      revenueAtRisk: result.revenueAtRisk,
      revenueUpside: result.revenueUpside,
      criticalCount: result.severityCounts.critical,
      highCount: result.severityCounts.high,
      mediumCount: result.severityCounts.medium,
      lowCount: result.severityCounts.low,
      summaryJson: JSON.stringify({
        executiveSummary: result.executiveSummary,
        analyzerVersion: result.analyzerVersion,
        lupa: result.meta.lupa,
        llm: result.meta.llm,
        revenueUpside: result.revenueUpside,
        revenueAtRisk: result.revenueAtRisk,
        expectedPeriodPayment: result.expectedPeriodPayment,
        paymentEstimate: result.paymentEstimate,
        durationMs: durationMs ?? null,
        /** Immutable first-analysis readiness (before any resolve/dismiss) */
        originalReadiness: result.scores.readiness,
        originalClinical: result.scores.clinical,
        originalCompliance: result.scores.compliance,
        originalRevenue: result.scores.revenue,
      }),
      categoryStatsJson: JSON.stringify(result.categoryStats),
      patientLabel: result.patientLabelHint,
      clinicianHint: result.clinicianHint,
      periodStartHint: result.periodHint,
      durationMs: durationMs ?? null,
      completedAt: new Date(),
      errorMessage: null,
    },
  });
}

async function maybeEmailReport(scanId: string) {
  const scan = await prisma.chartScan.findUnique({ where: { id: scanId } });
  if (!scan?.contactEmail || scan.status !== "COMPLETE") return;

  const payload = buildScanReportEmail({
    to: scan.contactEmail,
    contactName: scan.contactName,
    agencyName: scan.agencyNameHint,
    publicToken: scan.publicToken,
    readinessScore: scan.readinessScore,
    revenueAtRisk: scan.revenueAtRisk,
    revenueUpside: scan.revenueUpside,
    criticalCount: scan.criticalCount,
    highCount: scan.highCount,
  });

  const result = await sendEmail({
    to: scan.contactEmail,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });

  await writeAudit({
    agencyId: scan.agencyId,
    userId: scan.createdById,
    action: result.ok ? "scan.email_sent" : "scan.email_failed",
    entityType: "ChartScan",
    entityId: scan.id,
    meta: { mode: result.mode, id: result.id, error: result.error, to: scan.contactEmail },
  });
}

export type CreateScanState = { error?: string; token?: string };

async function resolveScanActors(session: Awaited<ReturnType<typeof getValidSession>>) {
  if (!session) {
    return {
      agencyId: null as string | null,
      createdById: null as string | null,
      wageIndex: null as number | null,
    };
  }

  const [agency, user] = await Promise.all([
    prisma.agency.findUnique({
      where: { id: session.agencyId },
      select: { id: true, wageIndex: true },
    }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } }),
  ]);

  return {
    agencyId: agency?.id ?? null,
    createdById: user?.id ?? null,
    wageIndex: agency?.wageIndex ?? null,
  };
}

export async function createScanFromTextAction(
  _prev: CreateScanState,
  formData: FormData,
): Promise<CreateScanState> {
  const session = await getValidSession();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim() || null;
  const contactName = String(formData.get("contactName") ?? "").trim() || null;
  const agencyNameHint = String(formData.get("agencyNameHint") ?? "").trim() || null;
  const chartText = String(formData.get("chartText") ?? "").trim();
  const sampleId = String(formData.get("useSample") ?? "").trim() as SampleChartId | "";
  const useSample = sampleId === "at-risk" || sampleId === "strong";
  const sendReportEmail = formData.get("sendEmail") === "1";

  const sample = useSample ? getSampleChart(sampleId) : null;
  const text = sample ? sample.text : chartText;
  const fileName = sample ? sample.fileName : "pasted-episode.txt";

  if (!useSample && text.length < 40) {
    return {
      error: "Paste at least a short episode excerpt, upload a file, or run a sample chart.",
    };
  }

  // Synthetic samples can run without email; custom pastes still need contact for guests
  if (!session && !contactEmail && !useSample) {
    return { error: "Email is required for free scans so we can associate your report." };
  }

  const actors = await resolveScanActors(session);
  // Samples: use provided email or a rate-limit bucket so demos always work
  const emailForLimit =
    contactEmail ?? session?.email ?? (useSample ? `sample+${sampleId}@guest.getupheld.com` : null);
  const limit = await assertFreeScanAllowed({
    email: emailForLimit,
    agencyId: actors.agencyId,
    authenticatedAgency: Boolean(session && actors.agencyId),
  });
  if (!limit.ok) return { error: limit.error };

  const resolvedEmail = contactEmail ?? session?.email ?? null;
  // Only email the report when the user gave a real address (not synthetic guest)
  const shouldEmail = sendReportEmail && Boolean(resolvedEmail);

  const publicToken = nanoid(24);
  let scan;
  try {
    scan = await prisma.chartScan.create({
      data: {
        publicToken,
        type: session && actors.agencyId ? "PILOT" : "FREE",
        status: "PROCESSING",
        agencyId: actors.agencyId,
        createdById: actors.createdById,
        contactEmail: resolvedEmail,
        contactName: contactName ?? session?.name ?? (useSample ? "Sample guest" : null),
        agencyNameHint: agencyNameHint ?? session?.agencyName ?? (useSample ? "Demo" : null),
        clientIpHash: limit.ipHash,
        expiresAt: session && actors.agencyId ? null : expiresAt(),
      },
    });
  } catch (e) {
    // Stale session / reseed: retry as guest-linked scan
    console.error("chartScan.create failed, retrying without agency link", e);
    scan = await prisma.chartScan.create({
      data: {
        publicToken,
        type: "FREE",
        status: "PROCESSING",
        agencyId: null,
        createdById: null,
        contactEmail: resolvedEmail,
        contactName: contactName ?? session?.name ?? (useSample ? "Sample guest" : null),
        agencyNameHint: agencyNameHint ?? session?.agencyName ?? (useSample ? "Demo" : null),
        clientIpHash: limit.ipHash,
        expiresAt: expiresAt(),
      },
    });
  }

  const started = Date.now();
  try {
    const result = await runChartScanPipeline({
      text,
      fileName,
      wageIndex: actors.wageIndex,
    });
    const durationMs = Date.now() - started;
    await persistAnalysis(scan.id, result, fileName, text, undefined, undefined, durationMs);
    await writeAudit({
      agencyId: session?.agencyId,
      userId: session?.userId,
      action: "scan.complete",
      entityType: "ChartScan",
      entityId: scan.id,
      meta: {
        readiness: result.scores.readiness,
        revenueAtRisk: result.revenueAtRisk,
        findingCount: result.findings.length,
        sample: useSample ? sampleId : false,
        lupa: result.meta.lupa.risk,
        llm: result.meta.llm,
        durationMs,
      },
    });
    if (shouldEmail) await maybeEmailReport(scan.id);
  } catch (e) {
    console.error("createScanFromTextAction analysis failed", e);
    await prisma.chartScan.update({
      where: { id: scan.id },
      data: {
        status: "FAILED",
        errorMessage: e instanceof Error ? e.message : "Analysis failed",
        durationMs: Date.now() - started,
      },
    });
    return {
      error:
        e instanceof Error
          ? `Analysis failed: ${e.message}`
          : "Analysis failed. Please try again.",
    };
  }

  revalidatePath("/scans");
  revalidatePath("/dashboard");
  revalidatePath("/executive");
  redirect(`/scan/${publicToken}`);
}

export async function createScanFromUploadAction(
  _prev: CreateScanState,
  formData: FormData,
): Promise<CreateScanState> {
  const session = await getValidSession();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim() || null;
  const contactName = String(formData.get("contactName") ?? "").trim() || null;
  const agencyNameHint = String(formData.get("agencyNameHint") ?? "").trim() || null;
  const sendReportEmail = formData.get("sendEmail") === "1";
  const file = formData.get("file");

  if (!session && !contactEmail) {
    return { error: "Email is required for free scans so we can associate your report." };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF, ZIP, or text file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "File exceeds 10 MB limit." };
  }

  const actors = await resolveScanActors(session);
  const emailForLimit = contactEmail ?? session?.email ?? null;
  const limit = await assertFreeScanAllowed({
    email: emailForLimit,
    agencyId: actors.agencyId,
    authenticatedAgency: Boolean(session && actors.agencyId),
  });
  if (!limit.ok) return { error: limit.error };

  const buf = Buffer.from(await file.arrayBuffer());
  const extracted = await extractTextFromUpload({
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    data: buf,
  });

  const pasteFallback = String(formData.get("chartText") ?? "").trim();
  const text =
    extracted.text.length >= 40
      ? extracted.text
      : pasteFallback.length >= 40
        ? pasteFallback
        : extracted.text;

  if (text.length < 40) {
    return {
      error:
        extracted.warnings[0] ??
        "Could not extract enough text. Paste chart text below, try a text export, or ZIP of .txt files.",
    };
  }

  const publicToken = nanoid(24);
  let scan;
  try {
    scan = await prisma.chartScan.create({
      data: {
        publicToken,
        type: session && actors.agencyId ? "PILOT" : "FREE",
        status: "PROCESSING",
        agencyId: actors.agencyId,
        createdById: actors.createdById,
        contactEmail: contactEmail ?? session?.email ?? null,
        contactName: contactName ?? session?.name ?? null,
        agencyNameHint: agencyNameHint ?? session?.agencyName ?? null,
        clientIpHash: limit.ipHash,
        expiresAt: session && actors.agencyId ? null : expiresAt(),
      },
    });
  } catch (e) {
    console.error("chartScan.create (upload) failed, retrying without agency link", e);
    scan = await prisma.chartScan.create({
      data: {
        publicToken,
        type: "FREE",
        status: "PROCESSING",
        agencyId: null,
        createdById: null,
        contactEmail: contactEmail ?? session?.email ?? null,
        contactName: contactName ?? session?.name ?? null,
        agencyNameHint: agencyNameHint ?? session?.agencyName ?? null,
        clientIpHash: limit.ipHash,
        expiresAt: expiresAt(),
      },
    });
  }

  const started = Date.now();
  try {
    const result = await runChartScanPipeline({
      text,
      fileName: file.name,
      wageIndex: actors.wageIndex,
    });
    const durationMs = Date.now() - started;
    const textParts = extracted.parts
      .filter((p) => p.text.trim().length > 0)
      .map((p) => ({ fileName: p.fileName, mimeType: p.mimeType, text: p.text }));

    await persistAnalysis(
      scan.id,
      result,
      file.name,
      text,
      {
        extractMethod: extracted.method,
        warnings: extracted.warnings,
        lupa: result.meta.lupa,
        llm: result.meta.llm,
      },
      textParts.length > 0
        ? textParts
        : [{ fileName: file.name, mimeType: file.type || "text/plain", text }],
      durationMs,
    );

    await writeAudit({
      agencyId: session?.agencyId,
      userId: session?.userId,
      action: "scan.complete",
      entityType: "ChartScan",
      entityId: scan.id,
      meta: {
        readiness: result.scores.readiness,
        revenueAtRisk: result.revenueAtRisk,
        fileName: file.name,
        extractMethod: extracted.method,
        lupa: result.meta.lupa.risk,
        llm: result.meta.llm,
        durationMs,
      },
    });
    if (sendReportEmail) await maybeEmailReport(scan.id);
  } catch (e) {
    await prisma.chartScan.update({
      where: { id: scan.id },
      data: {
        status: "FAILED",
        errorMessage: e instanceof Error ? e.message : "Analysis failed",
        durationMs: Date.now() - started,
      },
    });
    return { error: "Analysis failed. Please try again." };
  }

  revalidatePath("/scans");
  revalidatePath("/dashboard");
  revalidatePath("/executive");
  redirect(`/scan/${publicToken}`);
}

/**
 * Auth for finding status updates:
 * - Agency member on the scan's agency, OR
 * - Public report token so Free Chart Scan readiness path works without sign-in
 */
async function authorizeFindingMutation(opts: {
  findingId: string;
  scanToken?: string | null;
}): Promise<
  | {
      ok: true;
      finding: {
        id: string;
        scanId: string;
        publicToken: string;
        agencyId: string | null;
      };
      agencyId: string | null;
      userId: string | null;
    }
  | { ok: false }
> {
  const session = await getValidSession();
  const token = opts.scanToken?.trim() || null;

  const finding = await prisma.chartFinding.findUnique({
    where: { id: opts.findingId },
    include: {
      scan: { select: { publicToken: true, agencyId: true } },
    },
  });
  if (!finding) return { ok: false };

  const agencyOk =
    !!session &&
    !!finding.scan.agencyId &&
    session.agencyId === finding.scan.agencyId;
  const tokenOk = !!token && token === finding.scan.publicToken;

  if (!agencyOk && !tokenOk) return { ok: false };

  return {
    ok: true,
    finding: {
      id: finding.id,
      scanId: finding.scanId,
      publicToken: finding.scan.publicToken,
      agencyId: finding.scan.agencyId,
    },
    agencyId: session?.agencyId ?? finding.scan.agencyId,
    userId: session?.userId ?? null,
  };
}

export async function updateFindingStatusAction(formData: FormData): Promise<void> {
  const findingId = String(formData.get("findingId") ?? "");
  const status = String(formData.get("status") ?? "") as "OPEN" | "RESOLVED" | "DISMISSED";
  const scanToken = String(formData.get("scanToken") ?? "").trim() || null;
  if (!findingId || !["OPEN", "RESOLVED", "DISMISSED"].includes(status)) {
    return;
  }

  const auth = await authorizeFindingMutation({ findingId, scanToken });
  if (!auth.ok) return;

  await prisma.chartFinding.update({
    where: { id: findingId },
    data: { status },
  });

  await recomputeScanScoresFromOpenFindings(auth.finding.scanId);

  await writeAudit({
    agencyId: auth.agencyId,
    userId: auth.userId,
    action: "finding.status",
    entityType: "ChartFinding",
    entityId: findingId,
    meta: { status, via: scanToken ? "report_token" : "session" },
  });

  revalidatePath(`/scan/${auth.finding.publicToken}`);
  revalidatePath("/executive");
  revalidatePath("/issues");
  revalidatePath("/dashboard");
}

export async function bulkUpdateFindingsAction(formData: FormData): Promise<void> {
  const session = await getValidSession();
  const status = String(formData.get("status") ?? "") as "OPEN" | "RESOLVED" | "DISMISSED";
  const idsRaw = String(formData.get("findingIds") ?? "");
  const scanToken = String(formData.get("scanToken") ?? "").trim();
  const ids = idsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (!ids.length || !["OPEN", "RESOLVED", "DISMISSED"].includes(status)) return;

  const scan = scanToken
    ? await prisma.chartScan.findUnique({
        where: { publicToken: scanToken },
        select: { id: true, publicToken: true, agencyId: true },
      })
    : null;

  if (!scan && !session) return;

  const findings = await prisma.chartFinding.findMany({
    where: {
      id: { in: ids },
      ...(scan
        ? { scanId: scan.id }
        : { scan: { agencyId: session!.agencyId } }),
    },
    include: { scan: { select: { publicToken: true, agencyId: true } } },
  });

  if (findings.length === 0) return;

  if (scan) {
    if (findings.some((f) => f.scanId !== scan.id)) return;
  } else if (session) {
    if (findings.some((f) => f.scan.agencyId !== session.agencyId)) return;
  }

  await prisma.chartFinding.updateMany({
    where: { id: { in: findings.map((f) => f.id) } },
    data: { status },
  });

  if (findings[0]) {
    await recomputeScanScoresFromOpenFindings(findings[0].scanId);
  }

  await writeAudit({
    agencyId: session?.agencyId ?? findings[0]?.scan.agencyId ?? null,
    userId: session?.userId ?? null,
    action: "finding.bulk_status",
    entityType: "ChartFinding",
    meta: {
      status,
      count: findings.length,
      ids: findings.map((f) => f.id),
      via: scanToken ? "report_token" : "session",
    },
  });

  const token = scanToken || findings[0]?.scan.publicToken;
  if (token) revalidatePath(`/scan/${token}`);
  revalidatePath("/issues");
  revalidatePath("/executive");
  revalidatePath("/dashboard");
}

export type EmailScanState = { ok?: boolean; error?: string; mode?: string };

export async function emailScanReportAction(
  _prev: EmailScanState,
  formData: FormData,
): Promise<EmailScanState> {
  const token = String(formData.get("token") ?? "");
  const toOverride = String(formData.get("email") ?? "").trim();

  const scan = await prisma.chartScan.findUnique({ where: { publicToken: token } });
  if (!scan || scan.status !== "COMPLETE") {
    return { error: "Report not found or not ready." };
  }

  const session = await getValidSession();
  if (scan.agencyId && session && session.agencyId !== scan.agencyId) {
    // Agency-bound scans only emailable by same agency
    return { error: "Not authorized for this report." };
  }

  const to = toOverride || scan.contactEmail;
  if (!to) return { error: "Email address required." };

  const payload = buildScanReportEmail({
    to,
    contactName: scan.contactName,
    agencyName: scan.agencyNameHint,
    publicToken: scan.publicToken,
    readinessScore: scan.readinessScore,
    revenueAtRisk: scan.revenueAtRisk,
    revenueUpside: scan.revenueUpside,
    criticalCount: scan.criticalCount,
    highCount: scan.highCount,
  });

  const result = await sendEmail({
    to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });

  await writeAudit({
    agencyId: scan.agencyId,
    userId: session?.userId ?? scan.createdById,
    action: result.ok ? "scan.email_sent" : "scan.email_failed",
    entityType: "ChartScan",
    entityId: scan.id,
    meta: { mode: result.mode, id: result.id, error: result.error, to },
  });

  if (!result.ok) return { error: result.error ?? "Email failed", mode: result.mode };
  return { ok: true, mode: result.mode };
}
