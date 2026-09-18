import { createHash } from "node:crypto";

/** SHA-256 hex digest of raw bytes (lowercase). */
export function sha256Hex(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

/** SHA-256 hex digest of a UTF-8 string. */
export function sha256HexOfString(text: string): string {
  return sha256Hex(Buffer.from(text, "utf8"));
}

/** True if value looks like a 64-char hex digest. */
export function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}
