import { createHash } from "crypto";
import { headers } from "next/headers";
import { prisma } from "./db";

function maxPerHour(): number {
  const n = Number(process.env.FREE_SCAN_MAX_PER_HOUR ?? 12);
  return Number.isFinite(n) && n > 0 ? n : 12;
}

function maxPerDay(): number {
  const n = Number(process.env.FREE_SCAN_MAX_PER_DAY ?? 40);
  return Number.isFinite(n) && n > 0 ? n : 40;
}

export function hashIp(ip: string): string {
  const salt = process.env.SESSION_SECRET ?? "upheld-rate-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export async function getClientIpHash(): Promise<string | null> {
  try {
    const h = await headers();
    const xf = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "";
    const ip = xf.split(",")[0]?.trim();
    if (!ip) return null;
    return hashIp(ip);
  } catch {
    return null;
  }
}

export type RateLimitResult =
  | { ok: true; ipHash: string | null }
  | { ok: false; error: string; ipHash: string | null };

/**
 * Free Chart Scan abuse controls — per email and/or hashed IP.
 * Guest free scans are tightly capped. Authenticated agency users get much higher
 * volume (retrospective / pilot path). Batch retrospective jobs do not use this gate.
 */
export async function assertFreeScanAllowed(opts: {
  email?: string | null;
  agencyId?: string | null;
  /** Authenticated agency member — raise caps; batch path bypasses entirely */
  authenticatedAgency?: boolean;
}): Promise<RateLimitResult> {
  const ipHash = await getClientIpHash();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Agency workspace: platform team can run many single scans; still soft-capped
  const hourCap = opts.authenticatedAgency
    ? Number(process.env.AGENCY_SCAN_MAX_PER_HOUR ?? 200)
    : maxPerHour();
  const dayCap = opts.authenticatedAgency
    ? Number(process.env.AGENCY_SCAN_MAX_PER_DAY ?? 1000)
    : maxPerDay();

  const email = opts.email?.toLowerCase().trim() || null;

  // Skip per-email guest abuse limits for signed-in agency members
  if (email && !opts.authenticatedAgency) {
    const [hourEmail, dayEmail] = await Promise.all([
      prisma.chartScan.count({
        where: { contactEmail: email, createdAt: { gte: hourAgo } },
      }),
      prisma.chartScan.count({
        where: { contactEmail: email, createdAt: { gte: dayAgo } },
      }),
    ]);
    if (hourEmail >= hourCap) {
      return {
        ok: false,
        ipHash,
        error: `Rate limit: max ${hourCap} Free Chart Scans per hour for this email. Try again later or start a pilot.`,
      };
    }
    if (dayEmail >= dayCap) {
      return {
        ok: false,
        ipHash,
        error: `Rate limit: max ${dayCap} Free Chart Scans per day for this email. Contact ky@getupheld.com for pilot volume.`,
      };
    }
  }

  // Guest network caps only
  if (ipHash && !opts.authenticatedAgency) {
    const [hourIp, dayIp] = await Promise.all([
      prisma.chartScan.count({
        where: { clientIpHash: ipHash, createdAt: { gte: hourAgo } },
      }),
      prisma.chartScan.count({
        where: { clientIpHash: ipHash, createdAt: { gte: dayAgo } },
      }),
    ]);
    const ipHour = Math.max(hourCap, Math.ceil(hourCap * 1.5));
    const ipDay = Math.max(dayCap, Math.ceil(dayCap * 1.5));
    if (hourIp >= ipHour) {
      return {
        ok: false,
        ipHash,
        error: `Rate limit: too many Free Chart Scans from this network (max ~${ipHour}/hour). Sign in for agency volume or try later.`,
      };
    }
    if (dayIp >= ipDay) {
      return {
        ok: false,
        ipHash,
        error: `Rate limit: daily Free Chart Scan cap reached for this network. Sign in for retrospective batch analysis.`,
      };
    }
  }

  if (opts.agencyId) {
    const hourAgency = await prisma.chartScan.count({
      where: { agencyId: opts.agencyId, createdAt: { gte: hourAgo } },
    });
    const agencyHour = opts.authenticatedAgency
      ? Number(process.env.AGENCY_SCAN_MAX_PER_HOUR ?? 200)
      : Number(process.env.FREE_SCAN_MAX_PER_AGENCY_HOUR ?? 60);
    if (hourAgency >= agencyHour) {
      return {
        ok: false,
        ipHash,
        error: `Agency rate limit: max ${agencyHour} single scans/hour. Use Retrospective batch for cohorts of already-processed claims.`,
      };
    }
  }

  return { ok: true, ipHash };
}
