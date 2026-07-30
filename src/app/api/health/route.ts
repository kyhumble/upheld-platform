import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  CMS_NATIONAL_30_DAY_PERIOD_PAYMENT,
  CMS_PAYMENT_YEAR,
} from "@/domain/chart-scan/knowledge";
import { ANALYZER_VERSION } from "@/domain/chart-scan/types";
import { isChartEncryptionEnabled } from "@/lib/crypto";
import { isStripePilotEnabled } from "@/lib/stripe";
import { isOcrConfigured, resolveOcrProvider } from "@/domain/chart-scan/ocr";

export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbMs = Date.now() - started;

    let scanCount: number | null = null;
    let pilotLeads: number | null = null;
    try {
      const [scans, leads] = await Promise.all([
        prisma.chartScan.count(),
        prisma.pilotLead.count(),
      ]);
      scanCount = scans;
      pilotLeads = leads;
    } catch {
      scanCount = null;
      pilotLeads = null;
    }

    return NextResponse.json({
      ok: true,
      service: "upheld",
      product: "Clinical Revenue Integrity",
      version: "0.1.0",
      time: new Date().toISOString(),
      dbMs,
      analyzerVersion: ANALYZER_VERSION,
      cms: {
        paymentYear: CMS_PAYMENT_YEAR,
        national30DayPeriodPayment: CMS_NATIONAL_30_DAY_PERIOD_PAYMENT,
      },
      features: {
        encryption: isChartEncryptionEnabled(),
        resend: Boolean(process.env.RESEND_API_KEY),
        stripePilot: isStripePilotEnabled(),
        ocr: isOcrConfigured() ? resolveOcrProvider() : false,
      },
      scansIndexed: scanCount,
      pilotLeads,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "db_error",
        dbMs: Date.now() - started,
      },
      { status: 503 },
    );
  }
}
