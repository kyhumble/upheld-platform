# Retrospective batch analysis

**Purpose:** Platform / QA teams re-run Clinical Revenue Integrity on a cohort of **already-processed claims** and measure whether Upheld **would have caught** denials, LUPA, takebacks, and deductions *before* submission.

This is the primary proof path — not the guest single Free Chart Scan.

## Where

- UI: **Agency → Batch** (`/batch`) · Home & Executive show catch-rate proof rollup
- Sample: 5 synthetic labeled claims (one click) · download `/api/batch/sample-csv`
- Empty template: `/samples/retrospective-template.csv`
- Volume: default max **200** claims/job (`BATCH_MAX_CLAIMS`, cap 500)
- Processing: **chunked** (`BATCH_CHUNK_SIZE`, default 8) via `/api/batch/[id]/process`
- Period $: uses **agency wage index** from Settings on every claim
- Export: **board CSV** at `/api/batch/[id]/csv` · copy board read-out on job detail

## Input

### CSV columns

| Column | Required | Notes |
|--------|----------|--------|
| `claimId` | yes | Agency claim / episode id |
| `outcome` | yes | `PAID_CLEAN` · `DENIED` · `PARTIAL_DENIAL` · `LUPA` · `TAKEBACK` · `ADJUSTMENT` |
| `knownLossUsd` | no | Denial / deduction / LUPA gap dollars |
| `knownReason` | no | Free text (e.g. "Face-to-face missing") |
| `chartText` | if no file | Episode packet text |
| `fileName` | if ZIP | Points to a file inside the ZIP |

### ZIP layout

```
outcomes.csv
episodes/
  CLM-1001.txt
  CLM-1002.pdf
  ...
```

## Output metrics

| Metric | Meaning |
|--------|---------|
| **Catch rate** | Caught / adverse labeled claims |
| **Known loss** | Sum of `knownLossUsd` on adverse claims |
| **Loss on caught** | Known loss sitting on claims we would have flagged |
| **False pressure** | PAID_CLEAN claims with CRITICAL findings |
| **Protect / Capture $** | Modeled CMS-anchored dollars across the cohort |

## Auth & limits

- Requires signed-in agency session
- Does **not** use guest Free Chart Scan rate limits
- Authenticated single scans use higher caps (~200/hour)
- Prefer de-identified packets until BAA is signed
