# Upheld platform calculations

**Product:** Upheld Clinical Revenue Integrity  
**Audience:** Agency QA, revenue cycle, pilot evaluation, engineering  
**Version:** chart-scan-v3 + PDGM payment intelligence (Phase 2)  
**Status:** Advisory — **not** a certified CMS HIPPS grouper or remittance engine  

This document explains **every number** the platform shows: readiness scores, expected period payment, capture (recover), protect (at risk), and LUPA-related estimates.

---

## 1. What the platform is calculating

| Output | Question it answers |
|--------|---------------------|
| **Submission readiness (0–100)** | How “clean” is this packet for submission? |
| **Expected period total ($)** | What should **full PDGM period pay** be for *this* chart (advisory)? |
| **Capture / recoverable ($)** | What upside if documentation/coding is fixed? |
| **Protect / at risk ($)** | What is exposed if submitted as-is? |
| **Path to 80+** | Which open findings drag readiness, and in what order to fix? |
| **Batch would-have-caught** | On already-processed claims, would we have flagged the denial/LUPA? |

All dollar figures are **advisory**, anchored to **CMS CY 2026 Home Health PPS** national rates, then adjusted by a **chart-specific case-mix model**. They are **not** final claim amounts.

---

## 2. CMS rate anchors (source of truth for $)

### 2.1 National standardized 30-day period payment

| Parameter | Value | Notes |
|-----------|--------|--------|
| CMS payment year | **2026** | CY 2026 HH PPS Final Rule (CMS-1828-F) family |
| National 30-day base (quality data submitters) | **$2,038.22** | Used as `nationalBase` |
| National 30-day base (no quality data) | $1,998.41 | Available in code; not default for estimates |

**Important:** Under PDGM, agencies are paid in **30-day periods**. A physician **certification period** is often **60 days** and may include **two** 30-day payments. Upheld’s “expected period total” is for **one 30-day PDGM payment period**, not automatically 2 × that amount.

### 2.2 Per-visit rates (LUPA path)

Used when modeling low-utilization (LUPA) payment instead of full period:

| Discipline | CY 2026 national per-visit (approx.) |
|------------|--------------------------------------|
| Skilled nursing (SN) | **$176.96** |
| Physical therapy | $193.42 |
| Occupational therapy | $194.74 |
| Speech-language pathology | $210.25 |
| Medical social services | $283.64 |
| Home health aide | $80.12 |

### 2.3 Illustrative LUPA gap (national, mid-band)

\[
\text{LUPA gap}_\text{national} \approx \$2{,}038.22 - (5 \times \$176.96) \approx \$1{,}153
\]

Threshold “5” is a **mid-band family assumption**, not every HIPPS-specific LUPA threshold.

---

## 3. Expected period total (chart-specific)

### 3.1 Formula

\[
\boxed{\text{Expected period payment} = \text{National base} \times \text{Case-mix weight} \times \text{Wage index}}
\]

| Term | Default | Source |
|------|---------|--------|
| National base | $2,038.22 | CMS CY 2026 national standardized 30-day rate |
| Case-mix weight | Chart-inferred (see below) | Packet signals and/or sparse HIPPS table |
| Wage index | **1.0** (national) | Override with env `AGENCY_WAGE_INDEX` |

Example:

\[
\$2{,}038.22 \times 1.18 \times 1.00 \approx \$2{,}405
\]

### 3.2 How case-mix weight is built

**Method A — HIPPS table (when known)**  
If the chart contains a HIPPS code **and** that code is in Upheld’s small lookup table, that weight is used.

**Method B — Signal model (usual path)**  

\[
\text{Weight} = W_\text{family} \times F_\text{comorbidity} \times F_\text{functional} \times F_\text{timing} \times F_\text{admission}
\]

Weights are **clamped** to roughly **0.55 – 2.8** so outliers do not explode.

#### Clinical group family base weights

Inferred from narrative / diagnoses (wound, neuro, MMTA, complex, rehab, behavioral, default):

| Family | Relative base weight |
|--------|----------------------|
| COMPLEX | 1.32 |
| WOUND | 1.18 |
| NEURO | 1.14 |
| MS_REHAB | 1.10 |
| MMTA | 1.02 |
| DEFAULT | 1.00 |
| BEHAVIORAL | 0.96 |

#### Comorbidity band

| Band | Factor | How inferred (examples) |
|------|--------|-------------------------|
| NONE | 1.00 | Explicit “no secondary” / blank M1023 language |
| LOW | 1.06 | Some secondary dx / 2+ chronic markers |
| HIGH | 1.14 | Many markers (CHF, COPD, CKD, stage 3–4 ulcer, etc.) or “high comorbidity” |
| UNKNOWN | 1.02 | Insufficient signals |

#### Functional band

| Band | Factor | How inferred |
|------|--------|----------------|
| LOW | 0.94 | Independent / low OASIS-style scores |
| MEDIUM | 1.00 | Mid scores or unclear |
| HIGH | 1.10 | High M1800–M1860 / GG impairment or total assist language |
| UNKNOWN | 1.00 | Default |

#### Timing

| Band | Factor | How inferred |
|------|--------|----------------|
| EARLY | 1.03 | “Early”, SOC / first period language |
| LATE | 0.97 | “Late”, recert / second period |
| UNKNOWN | 1.00 | Default |

#### Admission source

| Band | Factor | How inferred |
|------|--------|----------------|
| COMMUNITY | 1.00 | Community admission / no recent inpatient |
| INSTITUTIONAL | 1.05 | Hospital / SNF / institutional language |
| UNKNOWN | 1.00 | Default |

### 3.3 Confidence

| Confidence | Meaning |
|------------|---------|
| HIGH | HIPPS hit in table, or many packet signals known |
| MEDIUM | Partial signals |
| LOW | Sparse chart → weight near national |

### 3.4 What expected period total is **not**

- Not final remittance  
- Not full CMS HIPPS weight file (thousands of cells)  
- Not CBSA wage index unless you set `AGENCY_WAGE_INDEX`  
- Not automatically 60-day cert total (would be ~two periods if both paid)

The report **basis line** lists the exact factors used for that scan.

---

## 4. Finding dollars (per issue)

Each finding may carry an **estimatedImpact** ($) and an **impactType**:

| impactType | Meaning on report |
|------------|-------------------|
| **EXPOSURE** | Protect — at risk if submitted as-is |
| **RECOVERY** | Capture — recoverable if fixed |
| **NEUTRAL** | Integrity/process issue without $ |

### 4.1 National defaults (before chart scaling)

Defaults are fractions of the **national** $2,038.22 base (rounded):

| Concept | Approx. national $ | Rule of thumb |
|---------|-------------------|---------------|
| F2F denial share | ~45% of period | Denial-class |
| Homebound | ~38% of period | Denial-class |
| Certification gap | ~22% of period | Denial-class |
| Order / signature | ~18% of period | Denial-class |
| Case-mix undercoding | ~11% of period | Capture |
| Comorbidity miss | ~5% of period | Capture |
| LUPA full-period gap | ~$1,153 | National mid-band |
| Late NOA | ~period/30 × 2 days | Exposure |
| Wound / skilled need | ~3–6% of period | Mixed |

### 4.2 Scaling to this chart’s period

After the chart’s **expected period payment** \(E\) is known:

\[
\text{Finding \$}_\text{chart} = \min\left(E,\; \text{Finding \$}_\text{national} \times \frac{E}{\$2{,}038.22}\right)
\]

So richer case-mix charts get **proportionally larger** advisory $; thin charts stay closer to national.

### 4.3 LUPA finding special case

When LUPA risk is **likely**, the LUPA finding impact is set toward:

\[
\text{LUPA gap}_\text{chart} \approx E - (5 \times \text{SN per-visit} \times \text{wage index})
\]

Visit counts still come from the chart (e.g. “3 skilled visits”). Threshold remains a **family mid-band** unless expanded with full HIPPS LUPA tables.

---

## 5. Capture (recover) and protect (at risk) totals

### 5.1 Protect — revenue at risk

Only findings with **EXPOSURE** and positive $:

1. **Denial-ceiling class** (F2F, homebound, certification, physician order/signature, and listed categories): take the **maximum** once — you cannot stack full denials of the same claim.  
2. **Other exposure** (LUPA gap, NOA, some clinical docs): **sum**.  
3. Final protect total:

\[
\text{Protect} = \min\bigl(\max(\text{denial ceiling},\; \text{other exposure sum}),\; E\bigr)
\]

where \(E\) = expected period payment for that chart.

### 5.2 Capture — recoverable if fixed

Only findings with **RECOVERY**:

\[
\text{Capture} = \min\bigl(\sum \text{RECOVERY \$},\; E\bigr)
\]

Capture and protect are **separate paths**. Do **not** add them to invent a new “total claim.” Think of them as:

- **Protect:** how much of \(E\) is in jeopardy as-is  
- **Capture:** how much additional/supported payment might be unlocked if coding/docs improve  

### 5.3 Report layout (three money cards)

| Card | Value |
|------|--------|
| **Expected period total** | \(E\) (chart-specific) |
| **Recoverable if fixed** | Capture |
| **At risk if submitted** | Protect |

---

## 6. Submission readiness score (0–100)

### 6.1 Severity penalties

| Severity | Penalty points |
|----------|----------------|
| CRITICAL | 22 |
| HIGH | 12 |
| MEDIUM | 6 |
| LOW | 2 |

### 6.2 Module scores

For each module \(m \in \{\text{CLINICAL}, \text{COMPLIANCE}, \text{REVENUE}\}\):

\[
\text{Module score}_m =
\begin{cases}
92 & \text{if no findings in } m \\
\max(0,\; \min(100,\; 100 - \sum \text{penalties in } m)) & \text{otherwise}
\end{cases}
\]

### 6.3 Overall readiness

\[
\boxed{\text{Readiness} = \text{round}(0.35 \times \text{Clinical} + 0.40 \times \text{Compliance} + 0.25 \times \text{Revenue})}
\]

Weights emphasize **compliance** (orders, F2F, homebound, certification) slightly more than clinical or revenue modules.

### 6.4 Live readiness vs analysis snapshot

| Concept | Definition |
|---------|------------|
| **Analysis snapshot** | Score at first complete analysis (stored as `originalReadiness`) |
| **Live readiness** | Recomputed from **OPEN** findings only |

When a finding is **Resolved** or **Dismissed**, it **no longer penalizes** live readiness. The ring and the path-to-80 panel both use **live** readiness so they stay aligned.

### 6.5 Path to readiness 80+

Gate: **READINESS_GATE = 80**.

If live readiness &lt; 80:

1. Rank **OPEN** findings by severity penalty (compliance slightly boosted).  
2. Show ordered **correction steps** (suggested fix + CMS ref when available).  
3. Project readiness after each successive fix.  
4. Highlight the step that **clears 80**.

---

## 7. Multi-pass analysis (how findings are produced)

| Pass | Module | Examples |
|------|--------|----------|
| 1 | Clinical Integrity | OASIS consistency, wound progression, skilled need narrative, reassessment |
| 2 | Compliance Intelligence | F2F, homebound, certification, signatures, CoP-related gaps |
| 3 | Revenue Intelligence | LUPA volume, comorbidity/coding support, NOA timing, PDGM-related undercoding |

Optional: LUPA structured pass rewrites/replaces LUPA findings from visit counts.  
Optional: LLM enrichment (off by default) may add findings; dollars still capped by \(E\).

Deterministic rules use CMS references (e.g. 42 CFR §424.22 for F2F) for citations — not for remittance math.

---

## 8. Retrospective batch (“would-have-caught”)

For already-processed claims with labeled outcomes (`DENIED`, `LUPA`, `TAKEBACK`, `PAID_CLEAN`, etc.):

1. Run the same multi-pass analysis per claim.  
2. Compare findings to **known outcome + known reason**.  
3. **Caught** = material HIGH/CRITICAL (or $ exposure) finding that matches the outcome family / reason keywords.  
4. **Catch rate** = caught ÷ adverse labeled claims.  
5. **Loss on caught** = sum of labeled `knownLossUsd` on claims marked caught.

This measures integrity detection quality against history — still not remittance simulation.

---

## 9. Worked example (illustrative)

**Chart signals:** Wound-heavy, early timing, community admission, high comorbidity language, low visit volume (LUPA risk).

1. **Weight** ≈ \(1.18 \times 1.14 \times 1.00 \times 1.03 \times 1.00 \approx 1.39\) (example)  
2. **Expected period** ≈ \(2038.22 \times 1.39 \times 1.0 \approx \$2{,}830\)  
3. F2F finding national ~$917 → scaled ~$1{,}275 (still ≤ \(E\))  
4. Denial-ceiling findings take **max**, not sum  
5. LUPA gap ≈ \(E - 5 \times 176.96\)  
6. **Protect** = min(max(denial ceiling, other exposure), \(E\))  
7. **Capture** = sum of recovery findings, capped at \(E\)  
8. **Readiness** from open severity penalties by module  

Actual numbers on a live report depend on the exact packet text.

---

## 10. Configuration knobs

| Env var | Effect |
|---------|--------|
| `AGENCY_WAGE_INDEX` | Multiplier on expected period (default **1.0**) |
| `FREE_SCAN_*` rate limits | Abuse controls only — not dollars |
| `XAI_API_KEY` / LLM | Optional finding enrichment — still capped by \(E\) |

---

## 11. Explicit non-claims (compliance language)

Upheld **does not**:

- Issue a certified HIPPS code as a grouper of record  
- Replace the Medicare claims system or MAC remittance  
- Guarantee payment, denial, or LUPA outcome  
- Train foundation models on customer PHI without separate consent  

Upheld **does**:

- Surface documentation, compliance, and revenue-integrity **risks**  
- Anchor $ to **CMS national rates** and a **transparent case-mix model**  
- Require **human review** before claim action  

---

## 12. Roadmap toward remittance-grade uniqueness

| Stage | Capability |
|-------|------------|
| **Today (Phase 2)** | Signal-based case-mix × national base × optional wage index; scaled capture/protect |
| **Next** | Full CMS HIPPS weight file + HIPPS-specific LUPA thresholds |
| **Later** | CBSA wage index by agency address; agency-specific fee schedule imports |

---

## 13. Where to see calculations in product

| Surface | What shows |
|---------|------------|
| Chart scan report | Expected period total, capture, protect, basis line, readiness, path to 80 |
| JSON `/api/scans/[token]` | `expectedPeriodPayment`, `paymentEstimate`, scores, findings |
| CSV export | Meta rows including readiness and $ fields |
| Trust page / CMS rate card | National anchors and per-visit reference |
| Retrospective batch | Would-have-caught rates vs labeled claim history |

---

## 14. Summary one-liner

> **Readiness** = weighted integrity of the chart.  
> **Expected period $** = CMS national 30-day base × chart-inferred case-mix × wage index.  
> **Protect** = exposure $ (denials max’d once, other exposure summed), capped at expected period.  
> **Capture** = recovery $ summed, capped at expected period.  
> **None of this is a remittance** — it is Clinical Revenue Integrity decision support.

---

*Document generated for Upheld / Humble Haus Ventures. Implementation: `src/domain/chart-scan/` (`knowledge.ts`, `scoring.ts`, `pdgm-payment.ts`, `readiness-path.ts`, `pipeline.ts`).*
