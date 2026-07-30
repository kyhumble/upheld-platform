"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getValidSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  buildSampleRetrospectiveManifest,
  parseManifestCsv,
  type ManifestRow,
} from "@/domain/batch/parse-manifest";
import type { RunnableClaim } from "@/domain/batch/run-batch";
import { createBatchJob, processBatchChunk } from "@/domain/batch/process-job";
import { extractTextFromUpload } from "@/domain/chart-scan/extract";

export type BatchActionState = { error?: string; jobId?: string };

const MAX_CLAIMS = Number(process.env.BATCH_MAX_CLAIMS ?? 200);
const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

function capClaims(): number {
  return Number.isFinite(MAX_CLAIMS) && MAX_CLAIMS > 0 ? Math.min(MAX_CLAIMS, 500) : 200;
}

/**
 * Create job, process first chunk immediately, redirect to detail.
 * Remaining chunks are processed by client → /api/batch/[id]/process
 */
async function createAndKickoff(opts: {
  agencyId: string;
  userId: string;
  name: string;
  source: string;
  rows: RunnableClaim[];
}) {
  const limit = capClaims();
  if (opts.rows.length === 0) throw new Error("No claims to analyze.");
  if (opts.rows.length > limit) {
    throw new Error(`Batch limited to ${limit} claims per job (got ${opts.rows.length}).`);
  }

  const jobId = await createBatchJob(opts);

  // First chunk so sample/small jobs often finish before page load
  await processBatchChunk(jobId);

  await writeAudit({
    agencyId: opts.agencyId,
    userId: opts.userId,
    action: "batch.started",
    entityType: "BatchJob",
    entityId: jobId,
    meta: { itemCount: opts.rows.length, source: opts.source },
  });

  return jobId;
}

export async function runSampleBatchAction(
  _prev?: BatchActionState | FormData,
  _formData?: FormData,
): Promise<BatchActionState> {
  const session = await getValidSession();
  if (!session) return { error: "Sign in required." };

  const rows = buildSampleRetrospectiveManifest().map((r) => ({
    ...r,
    chartText: r.chartText,
  }));

  try {
    const jobId = await createAndKickoff({
      agencyId: session.agencyId,
      userId: session.userId,
      name: `Sample retrospective · ${new Date().toISOString().slice(0, 10)}`,
      source: "sample",
      rows,
    });
    revalidatePath("/batch");
    revalidatePath(`/batch/${jobId}`);
    redirect(`/batch/${jobId}`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { error: e instanceof Error ? e.message : "Sample batch failed" };
  }
}

export async function runManifestBatchAction(
  _prev: BatchActionState,
  formData: FormData,
): Promise<BatchActionState> {
  const session = await getValidSession();
  if (!session) return { error: "Sign in required." };

  const name =
    String(formData.get("name") ?? "").trim() ||
    `Retrospective batch · ${new Date().toISOString().slice(0, 10)}`;
  const pasteManifest = String(formData.get("manifestCsv") ?? "").trim();
  const file = formData.get("file");

  let manifestText = pasteManifest;
  const fileTexts = new Map<string, string>();

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return { error: "Upload exceeds 40 MB limit." };
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const nameLower = file.name.toLowerCase();

    if (nameLower.endsWith(".csv") || file.type.includes("csv") || file.type.includes("text")) {
      manifestText = buf.toString("utf8");
    } else if (nameLower.endsWith(".zip") || file.type.includes("zip")) {
      const extracted = await extractTextFromUpload({
        fileName: file.name,
        mimeType: file.type || "application/zip",
        data: buf,
      });
      for (const p of extracted.parts) {
        fileTexts.set(p.fileName, p.text);
        fileTexts.set(p.fileName.split("/").pop() ?? p.fileName, p.text);
      }
      for (const key of ["outcomes.csv", "manifest.csv", "claims.csv", "batch.csv"]) {
        const hit = [...fileTexts.entries()].find(
          ([fn]) => fn.toLowerCase().endsWith(key) || fn.toLowerCase() === key,
        );
        if (hit) {
          manifestText = hit[1];
          break;
        }
      }
      if (!manifestText) {
        const auto: ManifestRow[] = extracted.parts
          .filter((p) => p.text.trim().length >= 40 && !p.fileName.toLowerCase().endsWith(".csv"))
          .slice(0, capClaims())
          .map((p, i) => ({
            claimId: (p.fileName.replace(/\.[^.]+$/, "") || `claim-${i + 1}`).slice(0, 120),
            knownOutcome: "UNKNOWN" as const,
            knownLossUsd: null,
            knownReason: null,
            chartText: p.text,
            fileName: p.fileName,
          }));
        if (auto.length === 0) {
          return {
            error:
              "ZIP had no readable charts. Include outcomes.csv plus episode text files.",
          };
        }
        try {
          const jobId = await createAndKickoff({
            agencyId: session.agencyId,
            userId: session.userId,
            name,
            source: "upload",
            rows: auto,
          });
          revalidatePath("/batch");
          redirect(`/batch/${jobId}`);
        } catch (e) {
          if (e && typeof e === "object" && "digest" in e) throw e;
          return { error: e instanceof Error ? e.message : "Batch failed" };
        }
      }
    } else {
      return { error: "Upload a .csv manifest or .zip of charts + outcomes.csv" };
    }
  }

  if (!manifestText) {
    return {
      error:
        "Provide a CSV manifest (claimId, outcome, knownLossUsd, knownReason, chartText or fileName).",
    };
  }

  const parsed = parseManifestCsv(manifestText);
  if (parsed.rows.length === 0) {
    return { error: parsed.errors[0] ?? "Could not parse any claim rows from the CSV." };
  }

  const rows: RunnableClaim[] = parsed.rows.map((r) => {
    let text = r.chartText;
    if ((!text || text.length < 40) && r.fileName) {
      text =
        fileTexts.get(r.fileName) ??
        fileTexts.get(r.fileName.split("/").pop() ?? "") ??
        text;
    }
    if ((!text || text.length < 40) && r.fileName) {
      const want = r.fileName.toLowerCase();
      for (const [fn, t] of fileTexts) {
        if (fn.toLowerCase() === want || fn.toLowerCase().endsWith(want)) {
          text = t;
          break;
        }
      }
    }
    return { ...r, chartText: text ?? "" };
  });

  const withText = rows.filter((r) => r.chartText.trim().length >= 40);
  if (withText.length === 0) {
    return {
      error:
        "No claim rows had enough chart text. Put text in chartText or ZIP files named in fileName.",
    };
  }

  try {
    const jobId = await createAndKickoff({
      agencyId: session.agencyId,
      userId: session.userId,
      name,
      source: "upload",
      rows: withText.slice(0, capClaims()),
    });
    revalidatePath("/batch");
    redirect(`/batch/${jobId}`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { error: e instanceof Error ? e.message : "Batch failed" };
  }
}
