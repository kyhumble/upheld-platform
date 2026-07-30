import { afterEach, describe, expect, it } from "vitest";
import { decryptField, encryptField, isChartEncryptionEnabled } from "./crypto";

const ORIGINAL = process.env.CHART_ENCRYPTION_KEY;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CHART_ENCRYPTION_KEY;
  else process.env.CHART_ENCRYPTION_KEY = ORIGINAL;
});

describe("chart field encryption", () => {
  it("pass-through without key", () => {
    delete process.env.CHART_ENCRYPTION_KEY;
    expect(isChartEncryptionEnabled()).toBe(false);
    expect(encryptField("hello PHI")).toBe("hello PHI");
    expect(decryptField("hello PHI")).toBe("hello PHI");
  });

  it("round-trips with hex key", () => {
    process.env.CHART_ENCRYPTION_KEY = "a".repeat(64);
    expect(isChartEncryptionEnabled()).toBe(true);
    const plain =
      "Patient DOB 01/01/1950 SOC OASIS M1800 face-to-face completed by Dr. Smith.";
    const enc = encryptField(plain);
    expect(enc.startsWith("enc:v1:")).toBe(true);
    expect(enc).not.toContain("DOB");
    expect(decryptField(enc)).toBe(plain);
  });

  it("round-trips with passphrase-derived key", () => {
    process.env.CHART_ENCRYPTION_KEY = "upheld-dev-passphrase-not-for-prod";
    const enc = encryptField("chart text");
    expect(decryptField(enc)).toBe("chart text");
  });

  it("idempotent encrypt on already-encrypted", () => {
    process.env.CHART_ENCRYPTION_KEY = "b".repeat(64);
    const once = encryptField("once");
    expect(encryptField(once)).toBe(once);
  });
});
