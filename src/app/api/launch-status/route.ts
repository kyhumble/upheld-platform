import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runEvalSuite } from "@/domain/chart-scan/eval";
import { GOLDEN_CASES } from "@/domain/chart-scan/eval-fixtures";
import {
  CMS_NATIONAL_30_DAY_PERIOD_PAYMENT,
  CMS_PAYMENT_YEAR,
} from "@/domain/chart-scan/knowledge";
import { ANALYZER_VERSION } from "@/domain/chart-scan/types";
import { isChartEncryptionEnabled } from "@/lib/crypto";
import { isStripePilotEnabled } from "@/lib/stripe";
import { isOcrConfigured, resolveOcrProvider } from "@/domain/chart-scan/ocr";

/**
 * Launch-gate status for Free Chart Scan.
 * ?eval=1 runs golden suite (heavier — use in CI / pre-release).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const runEval = url.searchParams.get("eval") === "1";

  const checks: Record<string, { ok: boolean; detail?: string }> = {
    database: { ok: false },
    rateLimitsConfigured: {
      ok: true,
      detail: `hour=${process.env.FREE_SCAN_MAX_PER_HOUR ?? 12} day=${process.env.FREE_SCAN_MAX_PER_DAY ?? 40}`,
    },
    retentionConfigured: {
      ok: true,
      detail: `FREE_SCAN_RETENTION_DAYS=${process.env.FREE_SCAN_RETENTION_DAYS ?? 30}`,
    },
    cronSecret: {
      ok: Boolean(process.env.CRON_SECRET),
      detail: process.env.CRON_SECRET ? "set" : "missing — purge cron unauthenticated",
    },
    chartEncryption: {
      ok: isChartEncryptionEnabled(),
      detail: isChartEncryptionEnabled()
        ? "AES-256-GCM at rest"
        : "plaintext at rest — set CHART_ENCRYPTION_KEY for PHI",
    },
    resendEmail: {
      ok: Boolean(process.env.RESEND_API_KEY),
      detail: process.env.RESEND_API_KEY ? "live" : "log-only mode",
    },
    stripePilot: {
      // Interest-only path is intentional for soft launch (Stripe deferred)
      ok: true,
      detail: isStripePilotEnabled()
        ? "Checkout enabled"
        : "deferred — interest form only (ok for soft launch)",
    },
    ocr: {
      ok: isOcrConfigured(),
      detail: isOcrConfigured()
        ? `provider=${resolveOcrProvider()}`
        : "text-layer only — set OCR_PROVIDER=azure|webhook",
    },
    llmOptional: {
      ok: true,
      detail: process.env.XAI_API_KEY
        ? `xAI ready (${process.env.XAI_MODEL ?? "default"})`
        : "deterministic-only",
    },
    cmsRates: {
      ok: true,
      detail: `CY ${CMS_PAYMENT_YEAR} base $${CMS_NATIONAL_30_DAY_PERIOD_PAYMENT}`,
    },
    analyzer: { ok: true, detail: ANALYZER_VERSION },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true };
  } catch (e) {
    checks.database = {
      ok: false,
      detail: e instanceof Error ? e.message : "db_error",
    };
  }

  let evalSummary: { passed: number; failed: number } | null = null;
  if (runEval) {
    const suite = await runEvalSuite(GOLDEN_CASES);
    evalSummary = { passed: suite.passed, failed: suite.failed };
    checks.goldenEval = {
      ok: suite.failed === 0,
      detail: `${suite.passed}/${suite.passed + suite.failed} cases`,
    };
  }

  // Latency sample from recent completed scans
  let latency: { sample: number; p50Ms: number | null; p95Ms: number | null } | null = null;
  try {
    const recent = await prisma.chartScan.findMany({
      where: { status: "COMPLETE", durationMs: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 50,
      select: { durationMs: true },
    });
    const ms = recent
      .map((r) => r.durationMs)
      .filter((n): n is number => n != null)
      .sort((a, b) => a - b);
    if (ms.length > 0) {
      const p = (q: number) => ms[Math.min(ms.length - 1, Math.floor(q * (ms.length - 1)))] ?? null;
      latency = { sample: ms.length, p50Ms: p(0.5), p95Ms: p(0.95) };
      checks.latencySample = {
        ok: (latency.p95Ms ?? 0) < 60_000,
        detail: `n=${latency.sample} p50=${latency.p50Ms}ms p95=${latency.p95Ms}ms`,
      };
    }
  } catch {
    /* non-fatal */
  }

  const required = ["database", "rateLimitsConfigured", "retentionConfigured", "analyzer"];
  const readyForDeidentifiedPublic = required.every((k) => checks[k]?.ok);
  const readyForPhi =
    readyForDeidentifiedPublic && checks.cronSecret.ok && checks.chartEncryption.ok;
  // Soft launch: de-id public + email + encryption + purge secret (OCR/Stripe optional)
  const readyForSoftLaunch =
    readyForDeidentifiedPublic &&
    checks.resendEmail.ok &&
    checks.chartEncryption.ok &&
    checks.cronSecret.ok;

  return NextResponse.json({
    ok: checks.database.ok,
    readyForDeidentifiedPublic,
    readyForSoftLaunch,
    readyForPhi,
    stripeDeferred: !isStripePilotEnabled(),
    checks,
    latency,
    eval: evalSummary,
    time: new Date().toISOString(),
  });
}
