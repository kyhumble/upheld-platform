import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./db", () => ({
  prisma: {
    chartScan: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    chartFinding: { count: vi.fn() },
    chartDocument: { count: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
}));

vi.mock("./audit", () => ({
  writeAudit: vi.fn(),
}));

import { prisma } from "./db";
import { purgeExpiredFreeScans } from "./purge";

describe("purgeExpiredFreeScans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dry-run reports expired without delete", async () => {
    vi.mocked(prisma.chartScan.findMany).mockResolvedValue([{ id: "a" }, { id: "b" }] as never);
    vi.mocked(prisma.chartFinding.count).mockResolvedValue(5);
    vi.mocked(prisma.chartDocument.count).mockResolvedValue(2);

    const r = await purgeExpiredFreeScans({ dryRun: true });
    expect(r.expiredScans).toBe(2);
    expect(r.deletedScans).toBe(0);
    expect(prisma.chartScan.deleteMany).not.toHaveBeenCalled();
  });

  it("execute deletes expired free scans", async () => {
    vi.mocked(prisma.chartScan.findMany).mockResolvedValue([{ id: "a" }] as never);
    vi.mocked(prisma.chartFinding.count).mockResolvedValue(3);
    vi.mocked(prisma.chartDocument.count).mockResolvedValue(1);
    vi.mocked(prisma.chartScan.deleteMany).mockResolvedValue({ count: 1 });

    const r = await purgeExpiredFreeScans({ dryRun: false });
    expect(r.deletedScans).toBe(1);
    expect(r.deletedFindings).toBe(3);
    expect(prisma.chartScan.deleteMany).toHaveBeenCalled();
  });
});
