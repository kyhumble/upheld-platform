import { getSampleChart } from "./sample-chart";
import type { GoldenCase } from "./eval";

const atRisk = getSampleChart("at-risk");
const strong = getSampleChart("strong");

/** Golden cases for Free Chart Scan launch gate. */
export const GOLDEN_CASES: GoldenCase[] = [
  {
    id: "at-risk-core",
    fileName: atRisk.fileName,
    text: atRisk.text,
    mustIncludeTitle: [
      "Face-to-face",
      "Homebound",
      "LUPA",
    ],
    mustIncludeCategory: ["Face-to-face", "LUPA risk", "Comorbidity capture"],
    mustIncludeImpactType: ["RECOVERY", "EXPOSURE"],
    maxReadiness: 75,
    minReadiness: 30,
    maxRevenueAtRisk: 4500, // chart-specific period cap (case-mix), not flat national only
    minRevenueUpside: 50,
  },
  {
    id: "strong-docs",
    fileName: strong.fileName,
    text: strong.text,
    mustIncludeTitle: [],
    mustExcludeTitle: ["Face-to-face encounter documentation missing"],
    minReadiness: 70,
    maxReadiness: 100,
    maxRevenueAtRisk: 2500,
  },
  {
    id: "empty-packet",
    fileName: "empty.txt",
    text: "short",
    mustIncludeTitle: ["Insufficient chart text"],
    maxReadiness: 30,
    maxRevenueAtRisk: 0,
  },
  {
    id: "lupa-low-visits",
    fileName: "lupa-snippet.txt",
    text: `
HOME HEALTH EPISODE PACKET — SYNTHETIC DEMO (NO REAL PHI)
Agency: Prairie Summit Home Health
Patient: "Demo Patient L"  MRN: ****9901
SOC Date: 2026-06-01   Certification Period: 06/01/2026 – 07/30/2026
Primary Payer: Medicare Traditional  PDGM Timing: Early  Admission Source: Community
M1021: Primary diagnosis  I50.9 Heart failure, unspecified
Face-to-face encounter completed 2026-05-28 with certifying physician signature on file.
Homebound status: taxing effort to leave home; absences infrequent and short duration for medical care.
Physician orders signed. POC established.
Visits completed to date: 2 SN + 1 PT. Visits scheduled for 30-day period: 3 total skilled visits.
Agency LUPA threshold for this HIPPS cluster typically 4–5 visits.
Wound: stage 2 heel ulcer length 2.0 cm width 1.2 cm depth documented.
OASIS functional scores M1800-M1860 present.
`.trim(),
    mustIncludeTitle: ["LUPA"],
    mustIncludeCategory: ["LUPA risk"],
    mustIncludeImpactType: ["EXPOSURE"],
    maxReadiness: 90,
    maxRevenueAtRisk: 4500,
  },
];
