/**
 * Parse a retrospective batch manifest (CSV) of already-processed claims.
 *
 * Expected columns (header row, case-insensitive):
 *   claimId (or claim_id, id)
 *   outcome (or knownOutcome, status) — PAID_CLEAN | DENIED | PARTIAL_DENIAL | LUPA | TAKEBACK | ADJUSTMENT
 *   knownLossUsd (or denial_amount, amount, loss) — optional
 *   knownReason (or denial_reason, reason) — optional
 *   chartText (or text, notes) — optional if ZIP supplies files
 *   fileName (or file) — optional pointer into ZIP
 */

import { getSampleChart } from "@/domain/chart-scan/sample-chart";
import { normalizeOutcome, type KnownOutcome } from "./retrospective";

export type ManifestRow = {
  claimId: string;
  knownOutcome: KnownOutcome;
  knownLossUsd: number | null;
  knownReason: string | null;
  chartText: string;
  fileName: string | null;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

const CLAIM_KEYS = ["claimid", "claim_id", "id", "claim", "episode_id", "mrn"];
const OUTCOME_KEYS = ["outcome", "knownoutcome", "known_outcome", "status", "result"];
const LOSS_KEYS = [
  "knownlossusd",
  "known_loss_usd",
  "denial_amount",
  "amount",
  "loss",
  "dollars",
  "impact",
];
const REASON_KEYS = [
  "knownreason",
  "known_reason",
  "denial_reason",
  "reason",
  "remark",
  "carc",
];
const TEXT_KEYS = ["charttext", "chart_text", "text", "notes", "packet", "body"];
const FILE_KEYS = ["filename", "file_name", "file", "path"];

function pick(map: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (map[k] != null && map[k] !== "") return map[k];
  }
  return "";
}

export function parseManifestCsv(csv: string): {
  rows: ManifestRow[];
  errors: string[];
} {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { rows: [], errors: ["Manifest needs a header row and at least one claim row."] };
  }

  const headers = splitCsvLine(lines[0]).map(normHeader);
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    idx[h] = i;
  });

  const hasClaim = CLAIM_KEYS.some((k) => k in idx || headers.includes(k));
  if (!hasClaim && !headers.some((h) => CLAIM_KEYS.includes(h))) {
    // soft: allow positional claimId as first column
  }

  const rows: ManifestRow[] = [];
  const errors: string[] = [];

  for (let li = 1; li < lines.length; li++) {
    const cols = splitCsvLine(lines[li]);
    const map: Record<string, string> = {};
    headers.forEach((h, i) => {
      map[h] = cols[i] ?? "";
    });

    const claimId =
      pick(map, CLAIM_KEYS) ||
      cols[0] ||
      `row-${li}`;

    if (!claimId) {
      errors.push(`Row ${li + 1}: missing claimId`);
      continue;
    }

    const lossRaw = pick(map, LOSS_KEYS);
    let knownLossUsd: number | null = null;
    if (lossRaw) {
      const n = Number(String(lossRaw).replace(/[$,]/g, ""));
      knownLossUsd = Number.isFinite(n) ? n : null;
    }

    rows.push({
      claimId: claimId.slice(0, 120),
      knownOutcome: normalizeOutcome(pick(map, OUTCOME_KEYS) || "UNKNOWN"),
      knownLossUsd,
      knownReason: pick(map, REASON_KEYS).slice(0, 500) || null,
      chartText: pick(map, TEXT_KEYS),
      fileName: pick(map, FILE_KEYS) || null,
    });
  }

  return { rows, errors };
}

/** Build sample retrospective set (synthetic, no PHI) for demo catch-rate. */
export function buildSampleRetrospectiveManifest(): ManifestRow[] {
  const atRisk = getSampleChart("at-risk");
  const strong = getSampleChart("strong");

  const deniedF2f = atRisk.text;
  const lupaLow = `
HOME HEALTH EPISODE — SYNTHETIC RETRO CLAIM
Claim: RETRO-LUPA-01  Outcome history: LUPA payment
SOC 2026-05-01  Medicare FFS  Early Community
M1021: I50.9 Heart failure
Face-to-face completed. Homebound documented.
Visits completed to date: 2 SN + 1 PT. Visits scheduled for 30-day period: 3 total skilled visits.
LUPA threshold typically 4–5. Agency paid per-visit LUPA.
`.trim();

  return [
    {
      claimId: "RETRO-001-DENIED-F2F",
      knownOutcome: "DENIED",
      knownLossUsd: 2038,
      knownReason: "Face-to-face documentation missing / incomplete",
      chartText: deniedF2f,
      fileName: atRisk.fileName,
    },
    {
      claimId: "RETRO-002-LUPA",
      knownOutcome: "LUPA",
      knownLossUsd: 1200,
      knownReason: "LUPA threshold not met — low skilled visits",
      chartText: lupaLow,
      fileName: "retro-lupa.txt",
    },
    {
      claimId: "RETRO-003-PAID-CLEAN",
      knownOutcome: "PAID_CLEAN",
      knownLossUsd: 0,
      knownReason: null,
      chartText: strong.text,
      fileName: strong.fileName,
    },
    {
      claimId: "RETRO-004-PARTIAL-CODING",
      knownOutcome: "PARTIAL_DENIAL",
      knownLossUsd: 450,
      knownReason: "Comorbidity / coding support insufficient",
      chartText: deniedF2f.replace(
        "Face-to-face",
        "Face-to-face encounter completed 05/28 with physician signature on file. Face-to-face",
      ),
      fileName: "retro-coding.txt",
    },
    {
      claimId: "RETRO-005-TAKEBACK-HOMEBOUND",
      knownOutcome: "TAKEBACK",
      knownLossUsd: 1800,
      knownReason: "Homebound status not supported",
      chartText: deniedF2f,
      fileName: "retro-homebound.txt",
    },
  ];
}
