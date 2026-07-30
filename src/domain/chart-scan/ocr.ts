/**
 * Production OCR adapters for thin / scanned PDFs.
 * Providers:
 *  - webhook: OCR_WEBHOOK_URL (generic JSON text)
 *  - azure: Azure AI Document Intelligence prebuilt-read
 */

export type OcrProvider = "none" | "webhook" | "azure";

export function resolveOcrProvider(): OcrProvider {
  const explicit = (process.env.OCR_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "azure" || explicit === "webhook" || explicit === "none") {
    return explicit;
  }
  if (process.env.AZURE_DOC_INTEL_ENDPOINT && process.env.AZURE_DOC_INTEL_KEY) {
    return "azure";
  }
  if (process.env.OCR_WEBHOOK_URL) return "webhook";
  return "none";
}

export function isOcrConfigured(): boolean {
  return resolveOcrProvider() !== "none";
}

export function pickOcrText(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const o = json as Record<string, unknown>;
  if (typeof o.text === "string") return o.text;
  if (typeof o.fullText === "string") return o.fullText;
  if (typeof o.markdown === "string") return o.markdown;
  if (typeof o.content === "string") return o.content;
  if (o.analyzeResult && typeof o.analyzeResult === "object") {
    const ar = o.analyzeResult as Record<string, unknown>;
    if (typeof ar.content === "string") return ar.content;
  }
  if (o.result && typeof o.result === "object") {
    const r = o.result as Record<string, unknown>;
    if (typeof r.text === "string") return r.text;
    if (typeof r.content === "string") return r.content;
  }
  if (o.data && typeof o.data === "object") {
    const d = o.data as Record<string, unknown>;
    if (typeof d.text === "string") return d.text;
  }
  if (Array.isArray(o.pages)) {
    return o.pages
      .map((p) =>
        p && typeof p === "object" && typeof (p as { text?: string }).text === "string"
          ? (p as { text: string }).text
          : "",
      )
      .filter(Boolean)
      .join("\n\n");
  }
  return "";
}

async function tryOcrWebhook(
  fileName: string,
  data: Buffer,
  warnings: string[],
): Promise<string> {
  const url = process.env.OCR_WEBHOOK_URL?.trim();
  if (!url) return "";

  const timeoutMs = Number(process.env.OCR_WEBHOOK_TIMEOUT_MS ?? 25_000);
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 25_000;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(process.env.OCR_WEBHOOK_SECRET
          ? { Authorization: `Bearer ${process.env.OCR_WEBHOOK_SECRET}` }
          : {}),
      },
      body: JSON.stringify({
        fileName,
        mimeType: "application/pdf",
        contentBase64: data.toString("base64"),
        sizeBytes: data.length,
      }),
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) {
      warnings.push(`OCR webhook HTTP ${res.status}`);
      return "";
    }
    const text = pickOcrText(await res.json()).trim();
    if (text.length >= 40) {
      warnings.push("OCR via webhook for thin PDF.");
      return text;
    }
    warnings.push("OCR webhook returned insufficient text.");
    return "";
  } catch (e) {
    warnings.push(`OCR webhook failed: ${e instanceof Error ? e.message : "unknown"}`);
    return "";
  }
}

/**
 * Azure AI Document Intelligence — prebuilt-read (async analyze + poll).
 * Env: AZURE_DOC_INTEL_ENDPOINT, AZURE_DOC_INTEL_KEY
 * Optional: AZURE_DOC_INTEL_API_VERSION (default 2024-11-30)
 */
async function tryAzureDocIntel(
  fileName: string,
  data: Buffer,
  warnings: string[],
): Promise<string> {
  const endpoint = process.env.AZURE_DOC_INTEL_ENDPOINT?.trim().replace(/\/$/, "");
  const key = process.env.AZURE_DOC_INTEL_KEY?.trim();
  if (!endpoint || !key) return "";

  const apiVersion = process.env.AZURE_DOC_INTEL_API_VERSION?.trim() || "2024-11-30";
  const analyzeUrl = `${endpoint}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=${apiVersion}`;

  try {
    const start = await fetch(analyzeUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/pdf",
      },
      body: new Uint8Array(data),
      signal: AbortSignal.timeout(30_000),
    });

    if (start.status !== 202) {
      const body = await start.text().catch(() => "");
      warnings.push(`Azure Doc Intel start HTTP ${start.status}: ${body.slice(0, 120)}`);
      return "";
    }

    const opLocation = start.headers.get("operation-location") ?? start.headers.get("Operation-Location");
    if (!opLocation) {
      warnings.push("Azure Doc Intel missing operation-location header.");
      return "";
    }

    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1200));
      const poll = await fetch(opLocation, {
        headers: { "Ocp-Apim-Subscription-Key": key },
        signal: AbortSignal.timeout(15_000),
      });
      if (!poll.ok) {
        warnings.push(`Azure Doc Intel poll HTTP ${poll.status}`);
        return "";
      }
      const json = (await poll.json()) as {
        status?: string;
        analyzeResult?: { content?: string };
      };
      if (json.status === "succeeded") {
        const text = (json.analyzeResult?.content ?? "").trim();
        if (text.length >= 40) {
          warnings.push(`OCR via Azure Document Intelligence (${fileName}).`);
          return text;
        }
        warnings.push("Azure Doc Intel returned insufficient text.");
        return "";
      }
      if (json.status === "failed") {
        warnings.push("Azure Doc Intel analysis failed.");
        return "";
      }
    }
    warnings.push("Azure Doc Intel timed out waiting for result.");
    return "";
  } catch (e) {
    warnings.push(`Azure Doc Intel failed: ${e instanceof Error ? e.message : "unknown"}`);
    return "";
  }
}

/** Run configured OCR provider on a PDF buffer. */
export async function runOcrOnPdf(
  fileName: string,
  data: Buffer,
  warnings: string[],
): Promise<string> {
  const provider = resolveOcrProvider();
  if (provider === "azure") return tryAzureDocIntel(fileName, data, warnings);
  if (provider === "webhook") return tryOcrWebhook(fileName, data, warnings);
  return "";
}
