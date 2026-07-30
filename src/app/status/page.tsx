import Link from "next/link";
import { MarketingHeader } from "@/components/marketing-header";
import {
  CMS_NATIONAL_30_DAY_PERIOD_PAYMENT,
  CMS_PAYMENT_YEAR,
} from "@/domain/chart-scan/knowledge";
import { ANALYZER_VERSION } from "@/domain/chart-scan/types";
import { isChartEncryptionEnabled } from "@/lib/crypto";
import { isStripePilotEnabled } from "@/lib/stripe";
import { isOcrConfigured, resolveOcrProvider } from "@/domain/chart-scan/ocr";
import { prisma } from "@/lib/db";
import { AmbientBackdrop, PageEnter, Reveal } from "@/components/site-motion";

export const metadata = {
  title: "System status",
  description: "Upheld Free Chart Scan platform status",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  let dbOk = false;
  let dbMs = 0;
  try {
    const t = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbMs = Date.now() - t;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const emailOk = Boolean(process.env.RESEND_API_KEY);
  const encryptOk = isChartEncryptionEnabled();
  const cronOk = Boolean(process.env.CRON_SECRET);
  const softLaunchReady = dbOk && emailOk && encryptOk && cronOk;

  const rows: { label: string; ok: boolean; detail: string; optional?: boolean }[] = [
    { label: "Database", ok: dbOk, detail: dbOk ? `${dbMs}ms` : "unreachable" },
    {
      label: "Analyzer",
      ok: true,
      detail: ANALYZER_VERSION,
    },
    {
      label: "CMS rates",
      ok: true,
      detail: `CY ${CMS_PAYMENT_YEAR} base $${CMS_NATIONAL_30_DAY_PERIOD_PAYMENT}`,
    },
    {
      label: "Chart encryption",
      ok: encryptOk,
      detail: encryptOk ? "AES-256-GCM" : "plaintext mode",
    },
    {
      label: "Email (Resend)",
      ok: emailOk,
      detail: emailOk ? "live" : "log-only",
    },
    {
      label: "OCR",
      ok: isOcrConfigured(),
      detail: isOcrConfigured() ? resolveOcrProvider() : "text-layer only",
    },
    {
      label: "Purge cron",
      ok: cronOk,
      detail: cronOk ? "secret set" : "unconfigured",
    },
    {
      label: "Stripe pilot",
      ok: true,
      detail: isStripePilotEnabled() ? "checkout on" : "deferred — interest form only",
      optional: true,
    },
  ];

  const coreOk = dbOk;

  return (
    <div className="relative min-h-screen bg-surface">
      <MarketingHeader />
      <div className="relative overflow-hidden">
        <AmbientBackdrop />
        <main className="relative mx-auto max-w-2xl px-4 py-10">
        <PageEnter>
        <div className="mb-4 flex justify-end">
          <Link href="/api/launch-status" className="text-xs font-semibold text-teal">
            JSON status →
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`relative flex h-3 w-3 ${coreOk ? "" : ""}`}
            aria-hidden
          >
            {coreOk ? (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-40" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-ok" />
              </>
            ) : (
              <span className="inline-flex h-3 w-3 rounded-full bg-danger" />
            )}
          </span>
          <h1 className="text-2xl font-semibold text-navy">
            {coreOk ? "Operational" : "Degraded"}
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted">
          Clinical Revenue Integrity platform · {new Date().toISOString()}
        </p>
        {softLaunchReady ? (
          <div className="mt-4 rounded-xl border border-ok/30 bg-emerald-50 px-4 py-3 text-sm text-navy shadow-sm">
            <strong className="text-ok">Soft launch ready</strong> — Free Scan, email, encryption,
            OCR, and retrospective batch. Stripe paid checkout deferred; pilot interest form is live.
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-warn/30 bg-amber-50 px-4 py-3 text-sm text-navy">
            Soft launch incomplete — check email, encryption, or cron rows below.
          </div>
        )}
        </PageEnter>
        <ul className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          {rows.map((r, i) => (
            <Reveal key={r.label} delayMs={i * 40} as="li">
              <div className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-mist/50">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${r.ok ? "bg-ok" : "bg-warn"}`}
                  aria-hidden
                />
                <span className="text-sm font-medium text-navy">{r.label}</span>
              </div>
              <span className="text-xs text-muted">{r.detail}</span>
              </div>
            </Reveal>
          ))}
        </ul>
        <p className="mt-6 text-center text-xs text-muted">
          <Link href="/scan" className="font-semibold text-teal hover:underline">
            Free Chart Scan
          </Link>
          {" · "}
          <Link href="/trust" className="hover:underline">
            Trust
          </Link>
        </p>
      </main>
      </div>
    </div>
  );
}
