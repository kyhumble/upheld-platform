# Free Chart Scan — public launch checklist

**Product:** Upheld Clinical Revenue Integrity · Phase 1 Free Chart Scan  
**DoD:** Safe enough for de-identified / BAA-gated traffic with measured quality and cost.

## Product quality

| # | Criterion | How we measure | Owner | Status |
|---|-----------|----------------|-------|--------|
| 1 | Golden eval suite green | `npm run eval` / CI | Eng | **Automated** |
| 2 | At-risk sample finds F2F + Homebound + LUPA | Golden `at-risk-core` | Eng | **Automated** |
| 3 | Strong sample readiness ≥ 70 | Golden `strong-docs` | Eng | **Automated** |
| 4 | Capture + protect both surface | Impact types on findings | Eng | **Done** |
| 5 | Human sampling ≥ 10 real charts | Spot-check vs QA specialist | Clinical | **Open** |
| 6 | Latency p95 &lt; 60s (text packet) | Logs / RUM | Eng | **Open** |
| 7 | Inference cost target under a few $/episode | Token + OCR spend | Eng | **Open** (deterministic free path) |

## Abuse & retention

| # | Criterion | How | Status |
|---|-----------|-----|--------|
| 8 | Per-email / IP rate limits | `FREE_SCAN_MAX_PER_*` + `clientIpHash` | **Done** |
| 9 | Free scan expiry | `FREE_SCAN_RETENTION_DAYS` + `expiresAt` | **Done** |
| 10 | Purge job | `npm run purge:expired -- --execute` / `/api/cron/purge` | **Done** |
| 11 | Cron secret in prod | `CRON_SECRET` + Vercel Cron | **Done** |

## Security / PHI

| # | Criterion | Status |
|---|-----------|--------|
| 12 | Trust page + BAA posture in settings | **Done** |
| 13 | Prefer de-identified Free Scan until BAA signed | **Done** (banner/guidance) |
| 14 | Subprocessor BAAs (Vercel, Neon, xAI, Resend, OCR) | **Open** |
| 15 | Field/object encryption for chart text | **Done** (`CHART_ENCRYPTION_KEY` + AES-256-GCM) |
| 16 | No model training on PHI without consent | **Policy** |

## Comms & conversion

| # | Criterion | Status |
|---|-----------|--------|
| 17 | Report email (Resend) | **Live** — domain verified · `reports@getupheld.com` |
| 18 | Pilot CTA + audit + confirmation/lead emails | **Done** (interest form; no card) |
| 18b | Stripe pilot checkout | **Deferred** intentionally for soft launch |
| 19 | Custom domain | **Live** www.getupheld.com · optional later `app.getupheld.com` |
| 20 | Public Free Scan | **Live** · SEO sitemap/robots |
| 21 | Production OCR | **Live** Azure Document Intelligence |
| 22 | Password self-service | **Done** — Settings → change password |

## Ops commands

```bash
npm run eval                    # golden accuracy gate
npm run purge:expired           # dry-run
npm run purge:expired -- --execute
curl -H "Authorization: Bearer $CRON_SECRET" https://upheld-platform.vercel.app/api/cron/purge
curl -H "Authorization: Bearer $CRON_SECRET" https://upheld-platform.vercel.app/api/ops/pilot-leads.csv
curl https://upheld-platform.vercel.app/api/launch-status
curl https://upheld-platform.vercel.app/api/billing/checkout   # enabled?
```

## Launch decision

**Soft launch (de-identified)** — ready when: 1–4, 8–11, 12–13, 15, 17, 20–21 pass. Stripe optional.  
Clinical spot-check (5) still recommended before paid pilots.  
**PHI Free Scan** only with 14 + signed customer BAA + purge verified in prod.

### Soft-launch status endpoint

```bash
curl https://www.getupheld.com/api/launch-status
# readyForSoftLaunch: true
```
