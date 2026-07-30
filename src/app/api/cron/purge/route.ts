import { NextResponse } from "next/server";
import { purgeExpiredFreeScans } from "@/lib/purge";

/**
 * Cron endpoint for expired FREE scan purge.
 * Auth: Authorization: Bearer $CRON_SECRET  (or ?secret=)
 *
 * Vercel Cron example:
 *   path: /api/cron/purge
 *   schedule: 0 6 * * *
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const q = url.searchParams.get("secret") ?? "";
  if (bearer !== secret && q !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const dryRun = url.searchParams.get("dryRun") === "1";
  const result = await purgeExpiredFreeScans({ dryRun });
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: Request) {
  return GET(req);
}
