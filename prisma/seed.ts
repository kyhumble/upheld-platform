import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { runChartScanPipeline } from "../src/domain/chart-scan/pipeline";
import { getSampleChart } from "../src/domain/chart-scan/sample-chart";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    console.error("Refusing demo seed in production without ALLOW_DEMO_SEED=true");
    process.exit(1);
  }

  await prisma.chartFinding.deleteMany();
  await prisma.chartDocument.deleteMany();
  await prisma.chartScan.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.agency.deleteMany();

  const agency = await prisma.agency.create({
    data: {
      name: "Summit Home Health (Demo)",
      slug: "summit-hh",
      planTier: "pilot",
      baaStatus: "pending",
      censusHint: 180,
    },
  });

  const passwordHash = await bcrypt.hash("password123", 10);

  const users = await Promise.all(
    [
      { email: "admin@demo.local", name: "Alex Chen (Admin)", role: "ADMIN" as const },
      { email: "qa@demo.local", name: "Jordan Miles (QA)", role: "QA" as const },
      { email: "clinical@demo.local", name: "Sam Rivera (RN)", role: "CLINICAL" as const },
      { email: "exec@demo.local", name: "Taylor Brooks (Exec)", role: "EXECUTIVE" as const },
    ].map((u) =>
      prisma.user.create({
        data: {
          email: u.email,
          name: u.name,
          passwordHash,
          memberships: {
            create: { agencyId: agency.id, role: u.role, status: "ACTIVE" },
          },
        },
      }),
    ),
  );

  const admin = users.find((u) => u.email === "admin@demo.local")!;
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);

  async function seedScan(sampleId: "at-risk" | "strong") {
    const sample = getSampleChart(sampleId);
    const result = await runChartScanPipeline({
      text: sample.text,
      fileName: sample.fileName,
      enableLlm: false,
    });
    const publicToken = nanoid(24);
    const scan = await prisma.chartScan.create({
      data: {
        publicToken,
        type: "FREE",
        status: "COMPLETE",
        agencyId: agency.id,
        createdById: admin.id,
        contactEmail: admin.email,
        contactName: admin.name,
        agencyNameHint: agency.name,
        patientLabel: result.patientLabelHint,
        clinicianHint: result.clinicianHint,
        periodStartHint: result.periodHint,
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
          sampleId,
        }),
        categoryStatsJson: JSON.stringify(result.categoryStats),
        completedAt: new Date(),
        expiresAt: expires,
        documents: {
          create: {
            fileName: sample.fileName,
            mimeType: "text/plain",
            sizeBytes: Buffer.byteLength(sample.text, "utf8"),
            documentType: "OASIS",
            extractedText: sample.text,
            metaJson: JSON.stringify({ seeded: true, sampleId }),
          },
        },
        findings: {
          create: result.findings.map((f, i) => ({
            module: f.module,
            category: f.category,
            severity: f.severity,
            title: f.title,
            description: f.description,
            suggestedCorrection: f.suggestedCorrection,
            cmsReference: f.cmsReference,
            estimatedImpact: f.estimatedImpact,
            impactType: f.impactType,
            evidenceExcerpt: f.evidenceExcerpt,
            sortOrder: i,
          })),
        },
      },
    });
    return { scan, result, sampleId };
  }

  const atRisk = await seedScan("at-risk");
  const strong = await seedScan("strong");

  console.log("Seeded Upheld demo agency");
  console.log("  Users (password: password123):");
  console.log("    admin@demo.local");
  console.log("    qa@demo.local");
  console.log("    clinical@demo.local");
  console.log("    exec@demo.local");
  console.log(
    `  At-risk sample: /scan/${atRisk.scan.publicToken} · readiness ${atRisk.result.scores.readiness} · $${atRisk.result.revenueAtRisk}`,
  );
  console.log(
    `  Strong sample:  /scan/${strong.scan.publicToken} · readiness ${strong.result.scores.readiness} · $${strong.result.revenueAtRisk}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
