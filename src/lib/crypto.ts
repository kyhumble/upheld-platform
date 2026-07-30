/**
 * Field-level encryption for chart text at rest (AES-256-GCM).
 * Format: enc:v1:<iv_b64url>:<tag_b64url>:<cipher_b64url>
 * Without CHART_ENCRYPTION_KEY, stores plaintext (dev / pre-PHI).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

function keyFromEnv(): Buffer | null {
  const raw = process.env.CHART_ENCRYPTION_KEY?.trim();
  if (!raw) return null;

  // Prefer 32-byte key from base64 or hex; otherwise derive from passphrase
  if (/^[A-Fa-f0-9]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  try {
    const b64 = Buffer.from(raw, "base64");
    if (b64.length === 32) return b64;
  } catch {
    /* fall through */
  }
  return createHash("sha256").update(raw).digest();
}

export function isChartEncryptionEnabled(): boolean {
  return keyFromEnv() != null;
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

/** Encrypt for storage. Pass-through when encryption key is unset. */
export function encryptField(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = keyFromEnv();
  if (!key) return plaintext;
  if (plaintext.startsWith(PREFIX)) return plaintext;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${b64url(iv)}:${b64url(tag)}:${b64url(enc)}`;
}

/** Decrypt if encrypted; otherwise return as-is (legacy plaintext rows). */
export function decryptField(stored: string): string {
  if (!stored || !stored.startsWith(PREFIX)) return stored;
  const key = keyFromEnv();
  if (!key) {
    throw new Error("Encrypted chart field present but CHART_ENCRYPTION_KEY is not set");
  }

  const body = stored.slice(PREFIX.length);
  const [ivPart, tagPart, cipherPart] = body.split(":");
  if (!ivPart || !tagPart || !cipherPart) {
    throw new Error("Malformed encrypted field");
  }

  const iv = fromB64url(ivPart);
  const tag = fromB64url(tagPart);
  const data = fromB64url(cipherPart);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Safe decrypt for display — never throws; returns redacted marker on failure. */
export function decryptFieldSafe(stored: string): string {
  try {
    return decryptField(stored);
  } catch {
    return "[encrypted — key unavailable]";
  }
}
