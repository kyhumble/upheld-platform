import { afterEach, describe, expect, it } from "vitest";
import { isOcrConfigured, pickOcrText, resolveOcrProvider } from "./ocr";

const KEYS = [
  "OCR_PROVIDER",
  "OCR_WEBHOOK_URL",
  "AZURE_DOC_INTEL_ENDPOINT",
  "AZURE_DOC_INTEL_KEY",
] as const;

const saved: Record<string, string | undefined> = {};

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function stash() {
  for (const k of KEYS) saved[k] = process.env[k];
}

describe("OCR helpers", () => {
  it("pickOcrText handles azure-style analyzeResult", () => {
    expect(
      pickOcrText({
        status: "succeeded",
        analyzeResult: { content: "Patient homebound Face-to-face completed OASIS M1021" },
      }),
    ).toMatch(/homebound/);
  });

  it("pickOcrText handles pages array", () => {
    expect(
      pickOcrText({ pages: [{ text: "hello chart text here" }, { text: "page two notes" }] }),
    ).toMatch(/page two/);
  });

  it("resolveOcrProvider prefers explicit OCR_PROVIDER", () => {
    stash();
    process.env.OCR_PROVIDER = "none";
    process.env.OCR_WEBHOOK_URL = "https://example.com";
    expect(resolveOcrProvider()).toBe("none");
    expect(isOcrConfigured()).toBe(false);
  });

  it("resolveOcrProvider detects azure keys", () => {
    stash();
    delete process.env.OCR_PROVIDER;
    delete process.env.OCR_WEBHOOK_URL;
    process.env.AZURE_DOC_INTEL_ENDPOINT = "https://example.cognitiveservices.azure.com";
    process.env.AZURE_DOC_INTEL_KEY = "key";
    expect(resolveOcrProvider()).toBe("azure");
    expect(isOcrConfigured()).toBe(true);
  });
});
