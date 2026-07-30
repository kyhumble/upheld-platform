/**
 * Document ingestion for Free Chart Scan.
 * Supports: TXT/MD/CSV, PDF (text-layer scrape), ZIP of mixed docs.
 * Optional OCR: webhook or Azure Document Intelligence for scanned PDFs.
 */

import { runOcrOnPdf } from "./ocr";

export type ExtractedPart = {
  fileName: string;
  mimeType: string;
  text: string;
  method: "utf8" | "pdf-text" | "zip-member" | "ocr" | "empty";
  warnings: string[];
};

export type ExtractResult = {
  text: string;
  parts: ExtractedPart[];
  method: "utf8" | "pdf-text" | "zip" | "mixed" | "ocr" | "empty";
  warnings: string[];
};

function decodePdfLiteral(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\\d{1,3}/g, " ");
}

/**
 * Best-effort PDF text-layer extraction (no native OCR).
 * Prefer text-exported PDFs. Set OCR_WEBHOOK_URL for scanned pages.
 */
function stripPdfStreams(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const chunks: string[] = [];

  const btBlocks = raw.matchAll(/BT([\s\S]{0,8000}?)ET/g);
  for (const block of btBlocks) {
    const body = block[1] ?? "";
    const literals = body.matchAll(/\((?:\\.|[^\\)]){2,}\)/g);
    for (const lit of literals) {
      const s = decodePdfLiteral(lit[0].slice(1, -1));
      if (/[A-Za-z]{2,}/.test(s)) chunks.push(s);
    }
    const hexes = body.matchAll(/<([0-9A-Fa-f\s]{4,})>/g);
    for (const hx of hexes) {
      try {
        const hex = hx[1].replace(/\s+/g, "");
        if (hex.length % 2 !== 0) continue;
        let out = "";
        for (let i = 0; i < hex.length; i += 2) {
          const code = parseInt(hex.slice(i, i + 2), 16);
          if (code >= 32 && code < 127) out += String.fromCharCode(code);
        }
        if (/[A-Za-z]{3,}/.test(out)) chunks.push(out);
      } catch {
        /* ignore */
      }
    }
  }

  const re = /\((?:\\.|[^\\)]){3,}\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const s = decodePdfLiteral(m[0].slice(1, -1));
    if (/[A-Za-z]{3,}/.test(s)) chunks.push(s);
  }

  const tj = raw.matchAll(/\((?:\\.|[^\\)])+\)\s*Tj/g);
  for (const match of tj) {
    const inner = decodePdfLiteral(match[0].replace(/\)\s*Tj$/, "").slice(1));
    if (/[A-Za-z]{3,}/.test(inner)) chunks.push(inner);
  }

  const ascii = raw.replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, " ");
  const runs = ascii.match(/[A-Za-z][A-Za-z0-9 ,.\-\/():%#]{12,}/g) ?? [];
  chunks.push(...runs);

  return chunks
    .join("\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractSingle(
  fileName: string,
  mimeType: string,
  data: Buffer,
): Promise<ExtractedPart> {
  const warnings: string[] = [];
  const name = fileName.toLowerCase();
  const mime = mimeType.toLowerCase();

  const isText =
    mime.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv") ||
    name.endsWith(".json");

  if (isText) {
    const text = data.toString("utf8").replace(/^\uFEFF/, "").trim();
    return {
      fileName,
      mimeType: mimeType || "text/plain",
      text,
      method: text ? "utf8" : "empty",
      warnings: text.length < 40 ? ["Text file is very short."] : [],
    };
  }

  const isPdf = mime === "application/pdf" || name.endsWith(".pdf");
  if (isPdf) {
    let text = stripPdfStreams(data);
    let method: ExtractedPart["method"] = text ? "pdf-text" : "empty";
    if (text.length < 80) {
      warnings.push(
        "PDF text layer thin or missing. For scanned charts, paste text or configure OCR.",
      );
      const ocr = await runOcrOnPdf(fileName, data, warnings);
      if (ocr.length >= 40) {
        text = ocr;
        method = "ocr";
      }
    }
    return {
      fileName,
      mimeType: mimeType || "application/pdf",
      text,
      method,
      warnings,
    };
  }

  const fallback = data.toString("utf8").replace(/\u0000/g, "").trim();
  if (fallback.length > 40 && /[A-Za-z]{10,}/.test(fallback)) {
    warnings.push(`Interpreted ${fileName} as text.`);
    return {
      fileName,
      mimeType,
      text: fallback,
      method: "utf8",
      warnings,
    };
  }

  warnings.push(
    `Unsupported type for ${fileName} (${mimeType || "unknown"}). Prefer PDF/TXT.`,
  );
  return {
    fileName,
    mimeType,
    text: "",
    method: "empty",
    warnings,
  };
}

/** Minimal ZIP local-file extraction (store + deflate) without external deps. */
async function extractZipMembers(data: Buffer): Promise<ExtractedPart[]> {
  const parts: ExtractedPart[] = [];
  let offset = 0;
  while (offset + 30 < data.length) {
    if (data[offset] !== 0x50 || data[offset + 1] !== 0x4b) break;
    if (data[offset + 2] !== 0x03 || data[offset + 3] !== 0x04) break;
    const compression = data.readUInt16LE(offset + 8);
    const compSize = data.readUInt32LE(offset + 18);
    const nameLen = data.readUInt16LE(offset + 26);
    const extraLen = data.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const fileName = data.slice(nameStart, nameStart + nameLen).toString("utf8");
    const dataStart = nameStart + nameLen + extraLen;
    const comp = data.slice(dataStart, dataStart + compSize);
    offset = dataStart + compSize;

    if (
      fileName.endsWith("/") ||
      fileName.startsWith("__MACOSX") ||
      fileName.includes(".DS_Store")
    ) {
      continue;
    }

    try {
      let raw: Buffer;
      if (compression === 0) {
        raw = comp;
      } else if (compression === 8) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const zlib = require("zlib") as typeof import("zlib");
        raw = zlib.inflateRawSync(comp);
      } else {
        parts.push({
          fileName,
          mimeType: "application/octet-stream",
          text: "",
          method: "empty",
          warnings: [`ZIP member ${fileName}: unsupported compression ${compression}`],
        });
        continue;
      }

      const lower = fileName.toLowerCase();
      const mime = lower.endsWith(".pdf")
        ? "application/pdf"
        : lower.endsWith(".txt") || lower.endsWith(".md")
          ? "text/plain"
          : "application/octet-stream";
      const single = await extractSingle(fileName, mime, raw);
      parts.push({
        ...single,
        method: single.method === "empty" ? "empty" : "zip-member",
      });
    } catch {
      parts.push({
        fileName,
        mimeType: "application/octet-stream",
        text: "",
        method: "empty",
        warnings: [`Failed to inflate ZIP member ${fileName}`],
      });
    }
  }
  return parts;
}

export async function extractTextFromUpload(params: {
  fileName: string;
  mimeType: string;
  data: Buffer;
}): Promise<ExtractResult> {
  const name = params.fileName.toLowerCase();
  const mime = params.mimeType.toLowerCase();
  const isZip =
    mime === "application/zip" ||
    mime === "application/x-zip-compressed" ||
    name.endsWith(".zip");

  if (isZip) {
    const members = await extractZipMembers(params.data);
    const withText = members.filter((m) => m.text.trim().length > 0);
    const warnings = members.flatMap((m) => m.warnings);
    if (withText.length === 0) {
      return {
        text: "",
        parts: members,
        method: "empty",
        warnings: warnings.length
          ? warnings
          : ["ZIP contained no extractable text documents."],
      };
    }
    const text = withText
      .map((m) => `===== FILE: ${m.fileName} =====\n${m.text}`)
      .join("\n\n");
    return {
      text,
      parts: members,
      method: "zip",
      warnings,
    };
  }

  const single = await extractSingle(params.fileName, params.mimeType, params.data);
  return {
    text: single.text,
    parts: [single],
    method:
      single.method === "pdf-text"
        ? "pdf-text"
        : single.method === "ocr"
          ? "ocr"
          : single.method === "utf8"
            ? "utf8"
            : "empty",
    warnings: single.warnings,
  };
}
