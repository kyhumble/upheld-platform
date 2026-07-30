import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { decryptFieldSafe } from "@/lib/crypto";
import { Logo } from "@/components/logo";
import { ScanReport } from "@/components/scan-report";
import { liveScoresFromFindings } from "@/domain/chart-scan/readiness-path";

export default async function PublicScanReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getSession();

  const scan = await prisma.chartScan.findUnique({
    where: { publicToken: token },
    include: {
      findings: { orderBy: { sortOrder: "asc" } },
      documents: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          documentType: true,
          extractedText: true,
          metaJson: true,
          createdAt: true,
          scanId: true,
          pageHint: true,
        },
        orderBy: { createdAt: "asc" },
      },
      agency: true,
    },
  });

  if (!scan) notFound();

  if (scan.expiresAt && scan.expiresAt < new Date() && scan.type === "FREE") {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-navy">Report expired</h1>
        <p className="mt-2 text-sm text-muted">
          Free Chart Scan retention window has ended. Run a new scan or start a pilot for ongoing
          history.
        </p>
        <Link href="/scan" className="mt-6 inline-block text-sm font-semibold text-teal">
          New Free Chart Scan
        </Link>
      </div>
    );
  }

  // Agency members can resolve; Free Chart Scan / public report link holders can too (token auth)
  const canResolve =
    (!!session && !!scan.agencyId && session.agencyId === scan.agencyId) ||
    scan.status === "COMPLETE";

  // Decrypt PHI fields for authorized report render
  const documents = scan.documents.map((d) => ({
    ...d,
    extractedText: decryptFieldSafe(d.extractedText),
  }));
  const findings = scan.findings.map((f) => ({
    ...f,
    evidenceExcerpt: f.evidenceExcerpt ? decryptFieldSafe(f.evidenceExcerpt) : null,
  }));

  // Keep stored scores in sync with open findings (fixes ring vs path drift after resolve)
  const live = liveScoresFromFindings(findings);
  if (
    scan.status === "COMPLETE" &&
    (scan.readinessScore !== live.readiness ||
      scan.clinicalScore !== live.clinical ||
      scan.complianceScore !== live.compliance ||
      scan.revenueScore !== live.revenue)
  ) {
    const open = findings.filter((f) => f.status === "OPEN");
    await prisma.chartScan.update({
      where: { id: scan.id },
      data: {
        readinessScore: live.readiness,
        clinicalScore: live.clinical,
        complianceScore: live.compliance,
        revenueScore: live.revenue,
        criticalCount: open.filter((f) => f.severity === "CRITICAL").length,
        highCount: open.filter((f) => f.severity === "HIGH").length,
        mediumCount: open.filter((f) => f.severity === "MEDIUM").length,
        lowCount: open.filter((f) => f.severity === "LOW").length,
      },
    });
    scan.readinessScore = live.readiness;
    scan.clinicalScore = live.clinical;
    scan.complianceScore = live.compliance;
    scan.revenueScore = live.revenue;
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="no-print border-b border-border bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href={session ? "/dashboard" : "/"}>
            <Logo size={28} subtitle="Chart Scan Report" />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/scan" className="font-medium text-navy hover:underline">
              New scan
            </Link>
            {session ? (
              <Link href="/scans" className="text-muted hover:text-navy">
                History
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {scan.status === "FAILED" ? (
          <div className="rounded-xl border border-danger/30 bg-red-50 p-6 text-sm text-danger">
            Analysis failed: {scan.errorMessage ?? "Unknown error"}
          </div>
        ) : scan.status !== "COMPLETE" ? (
          <div className="rounded-xl border border-border bg-white p-8 text-center">
            <p className="text-sm font-medium text-navy">Analysis in progress…</p>
            <p className="mt-2 text-xs text-muted">Refresh in a moment if this persists.</p>
          </div>
        ) : (
          <ScanReport
            scan={{ ...scan, findings, documents }}
            canResolve={canResolve}
            showPilotCta
          />
        )}
      </main>
    </div>
  );
}
