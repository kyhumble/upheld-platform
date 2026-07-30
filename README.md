# Upheld

**Clinical Revenue Integrity** for Medicare home health — Phase 1 standalone SaaS.

> Every episode is evaluated for documentation quality, reimbursement readiness, and compliance risk **before** it is submitted.

This is a **new standalone product codebase** (not a fork of OASIS Copilot, DocuGuard, or ClearBill).  
Primary conversion engine: **Free Chart Scan**.

## What ships in this MVP

- Free Chart Scan (public + authenticated) — conversion engine
- Multi-pass analysis: **Clinical Integrity · Compliance · Revenue Intelligence**
- **Capture $** (recovery) + **Protect $** (exposure), CMS CY 2026 national anchors
- Structured **LUPA risk model** (visit volume vs clinical-group thresholds)
- Optional **xAI LLM enrichment** (structured JSON merge; off by default)
- Submission Readiness Score (0–100) + dual dollar paths
- Ranked findings with severity, suggested corrections, CMS references
- Interactive report (print / share link / email / CSV / JSON)
- PDF + **ZIP** ingestion · optional **Azure OCR** / webhook for scanned PDFs
- Rate limits, free-scan retention purge, field encryption at rest
- Pilot path: interest emails + optional **Stripe Checkout** + lead CRM
- Agency workspace: issues worklist, clinicians, executive scorecard, activity
- Ops: `/api/launch-status`, `/status`, golden eval (`npm run eval`)

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 15 + TypeScript + Tailwind 4 |
| DB | PostgreSQL + Prisma |
| Auth | Cookie JWT (jose + bcrypt) |
| Analysis | Domain multi-pass engine (`src/domain/chart-scan`) |

## Production (live)

| | |
|--|--|
| **App** | https://www.getupheld.com |
| **Vercel project** | `upheld-platform` (separate from marketing / oasis-copilot) |
| **Database** | Neon · DB `upheld_cri` |
| **Email** | Resend (`reports@getupheld.com`) |
| **OCR** | Azure Document Intelligence |
| **Stripe** | Deferred — pilot interest form only |

```bash
cd ~/upheld
npx vercel deploy --prod --yes
```

Demo on production (synthetic only): `admin@demo.local` / `password123`

## Local setup

```bash
# Prerequisites: Node 20+, Docker
cd ~/upheld
cp .env.example .env
docker compose up -d          # Postgres on host port 5436
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo users (password: `password123`)

| Email | Role |
|-------|------|
| `admin@demo.local` | Admin |
| `qa@demo.local` | QA |
| `clinical@demo.local` | Clinical |
| `exec@demo.local` | Executive |

### Try Free Chart Scan without login

1. Go to `/scan`
2. Enter any work email
3. Click **Run sample synthetic chart**

## Scripts

```bash
npm run dev          # Next dev (turbopack)
npm run test         # Vitest (analyzer unit tests)
npm run typecheck
npm run build
npm run db:reset     # wipe + reseed
```

## Product principles (locked)

- EMR-agnostic intelligence layer (upload first → APIs later)
- Category: **Clinical Revenue Integrity** — never “QA software”
- Free Chart Scan is the top-of-funnel product
- Human-in-the-loop is non-negotiable
- HIPAA-ready posture: BAA before identifiable PHI, retention on free scans, audit log

## Repo layout

```
src/
  app/                 # Landing, Free Scan, report, agency app
  components/          # UI, scan form, professional report
  domain/chart-scan/   # Multi-pass analyzer, scoring, sample chart
  lib/                 # auth, db, audit
  server/actions/      # auth + scan mutations
prisma/                # schema + seed
```

## Not in this repo

Previous experiments remain separate:

- `~/oasis-copilot` — HCHB-oriented OASIS scrub prototype  
- `~/docuguard` — documentation co-pilot  
- `~/clearbill-hh` — UI mock  

Upheld Phase 1 lives here only.

## API

```
GET /api/health
GET /api/scans/:token   # JSON report export (no full chart text)
```

## Next engineering increments

1. Production OCR (Textract / Document AI) for scanned PDFs  
2. Full HIPPS-specific LUPA tables from current CMS rate files  
3. Encrypted object storage for chart artifacts  
4. HIPAA hosting BAAs + SOC 2 path  
5. Ongoing episode monitoring (beyond one-off scans)  
6. HCHB / EMR API embeds (Phase 1 late)  

---

Humble Haus Ventures · July 2026
