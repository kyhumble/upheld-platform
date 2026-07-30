/**
 * Optional frontier-model enrichment pass.
 * Merges additional structured findings into deterministic analysis.
 * Never required for Free Chart Scan — mock path is production-safe for demos.
 */

import { z } from "zod";
import type { AnalysisFinding, ImpactType } from "./types";
import { CMS_REFS } from "./knowledge";

const LlmFindingSchema = z.object({
  module: z.enum(["CLINICAL", "COMPLIANCE", "REVENUE"]),
  category: z.string().min(1).max(80),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(2000),
  suggestedCorrection: z.string().min(5).max(2000),
  cmsReference: z.string().nullable().optional(),
  estimatedImpact: z.number().nullable().optional(),
  impactType: z.enum(["RECOVERY", "EXPOSURE", "NEUTRAL"]).optional(),
  evidenceExcerpt: z.string().nullable().optional(),
});

const LlmResponseSchema = z.object({
  findings: z.array(LlmFindingSchema).max(20),
  notes: z.string().optional(),
});

export type LlmEnrichResult = {
  findings: AnalysisFinding[];
  provider: string;
  model: string;
  latencyMs: number;
  used: boolean;
  error?: string;
};

function resolveProvider(): "xai" | "none" {
  const forced = process.env.AI_PROVIDER?.toLowerCase();
  if (forced === "mock" || forced === "none") return "none";
  if (forced === "xai" || process.env.XAI_API_KEY) return "xai";
  return "none";
}

function buildPrompt(chartText: string, existingTitles: string[]): string {
  const truncated = chartText.slice(0, 14000);
  return `You are a senior home health Clinical Revenue Integrity specialist (CMS / PDGM / OASIS / CoP).
Review the episode packet and return ONLY additional findings not already covered.

Already identified (do not repeat):
${existingTitles.map((t) => `- ${t}`).join("\n") || "(none)"}

Return strict JSON:
{
  "findings": [
    {
      "module": "CLINICAL" | "COMPLIANCE" | "REVENUE",
      "category": "string",
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "title": "string",
      "description": "string",
      "suggestedCorrection": "string",
      "cmsReference": "string or null",
      "estimatedImpact": number or null,
      "impactType": "RECOVERY" | "EXPOSURE" | "NEUTRAL",
      "evidenceExcerpt": "short quote or null"
    }
  ],
  "notes": "optional short note"
}

Rules:
- Only flag issues supported by the chart text.
- impactType RECOVERY = missed capture / undercoding if fixed (adds revenue). EXPOSURE = denial/LUPA/takeback risk (protects revenue). NEUTRAL = no $.
- Tie revenue findings to dollars when possible (advisory).
- CMS CY 2026 national standardized 30-day period payment is $2,038.22 (before case-mix/wage). Never assign more than that on a single finding; do not invent multi-claim totals.
- Prefer actionable corrections over generic advice.
- Max 8 findings.
- Human review is required; do not invent diagnoses.

EPISODE TEXT:
${truncated}`;
}

export async function enrichWithLlm(params: {
  chartText: string;
  existingFindings: AnalysisFinding[];
  signal?: AbortSignal;
}): Promise<LlmEnrichResult> {
  const provider = resolveProvider();
  if (provider === "none") {
    return {
      findings: [],
      provider: "none",
      model: "deterministic-only",
      latencyMs: 0,
      used: false,
    };
  }

  const apiKey = process.env.XAI_API_KEY;
  const model = process.env.XAI_MODEL ?? "grok-3-latest";
  if (!apiKey) {
    return {
      findings: [],
      provider: "xai",
      model,
      latencyMs: 0,
      used: false,
      error: "XAI_API_KEY not set",
    };
  }

  const started = Date.now();
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      signal: params.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You produce structured Clinical Revenue Integrity findings as JSON only. No markdown.",
          },
          {
            role: "user",
            content: buildPrompt(
              params.chartText,
              params.existingFindings.map((f) => f.title),
            ),
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        findings: [],
        provider: "xai",
        model,
        latencyMs: Date.now() - started,
        used: false,
        error: `xAI HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = LlmResponseSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      return {
        findings: [],
        provider: "xai",
        model,
        latencyMs: Date.now() - started,
        used: false,
        error: "Invalid LLM JSON shape",
      };
    }

    const existing = new Set(
      params.existingFindings.map((f) => f.title.toLowerCase().trim()),
    );
    const findings: AnalysisFinding[] = parsed.data.findings
      .filter((f) => !existing.has(f.title.toLowerCase().trim()))
      .map((f) => {
        const impactType =
          f.impactType ??
          (/comorbidity|undercod|case-mix|coding/i.test(f.category + f.title)
            ? "RECOVERY"
            : (f.estimatedImpact ?? 0) > 0
              ? "EXPOSURE"
              : "NEUTRAL");
        return {
          module: f.module,
          category: f.category,
          severity: f.severity,
          title: f.title,
          description: f.description,
          suggestedCorrection: f.suggestedCorrection,
          cmsReference:
            f.cmsReference ??
            (f.module === "COMPLIANCE" ? CMS_REFS.COP_SURVEY : CMS_REFS.PDGM),
          estimatedImpact: f.estimatedImpact ?? null,
          impactType: impactType as ImpactType,
          evidenceExcerpt: f.evidenceExcerpt ?? null,
        };
      });

    return {
      findings,
      provider: "xai",
      model,
      latencyMs: Date.now() - started,
      used: true,
    };
  } catch (e) {
    return {
      findings: [],
      provider: "xai",
      model,
      latencyMs: Date.now() - started,
      used: false,
      error: e instanceof Error ? e.message : "LLM enrich failed",
    };
  }
}
