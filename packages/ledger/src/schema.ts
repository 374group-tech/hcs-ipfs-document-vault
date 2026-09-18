import { isSha256Hex } from "./hash";

/** On-chain HCS attestation payload for a vaulted document. */
export type VaultAttestation = {
  cid: string;
  sha256: string;
  size: number;
  payer: string;
  memo: string;
  ts: number;
};

const CID_RE = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]{50,}|bafk[a-z2-7]{50,})$/i;
const ACCOUNT_RE = /^0\.0\.\d+$/;

export function isLikelyCid(cid: string): boolean {
  if (!cid || cid.length < 10 || cid.length > 128) return false;
  // Accept classic CIDv0, common CIDv1, and dry-run placeholders starting with bafy/Qm
  if (CID_RE.test(cid)) return true;
  // Allow documented dry-run / precomputed CIDs that are base58/base32-ish
  return /^[A-Za-z0-9]+$/.test(cid) && cid.length >= 46;
}

export function isHederaAccountId(id: string): boolean {
  return ACCOUNT_RE.test(id);
}

export type ParseAttestationResult =
  | { ok: true; value: VaultAttestation }
  | { ok: false; error: string };

/** Validate and normalize an HCS message body (JSON string or object). */
export function parseVaultAttestation(input: unknown): ParseAttestationResult {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch {
      return { ok: false, error: "message is not valid JSON" };
    }
  }
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "message must be a JSON object" };
  }
  const o = raw as Record<string, unknown>;
  const cid = o.cid;
  const sha256 = o.sha256;
  const size = o.size;
  const payer = o.payer;
  const memo = o.memo;
  const ts = o.ts;

  if (typeof cid !== "string" || !isLikelyCid(cid)) {
    return { ok: false, error: "cid missing or invalid" };
  }
  if (typeof sha256 !== "string" || !isSha256Hex(sha256)) {
    return { ok: false, error: "sha256 must be 64 hex chars" };
  }
  if (typeof size !== "number" || !Number.isFinite(size) || size < 0 || !Number.isInteger(size)) {
    return { ok: false, error: "size must be a non-negative integer" };
  }
  if (typeof payer !== "string" || !isHederaAccountId(payer)) {
    return { ok: false, error: "payer must be a Hedera account id 0.0.x" };
  }
  if (typeof memo !== "string") {
    return { ok: false, error: "memo must be a string" };
  }
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) {
    return { ok: false, error: "ts must be a positive unix epoch (ms or s)" };
  }

  return {
    ok: true,
    value: {
      cid,
      sha256: sha256.toLowerCase(),
      size,
      payer,
      memo,
      ts,
    },
  };
}

/** Serialize attestation for HCS TopicMessageSubmit (compact JSON). */
export function serializeVaultAttestation(attestation: VaultAttestation): string {
  const parsed = parseVaultAttestation(attestation);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const v = parsed.value;
  return JSON.stringify({
    cid: v.cid,
    sha256: v.sha256,
    size: v.size,
    payer: v.payer,
    memo: v.memo,
    ts: v.ts,
  });
}

/** Build a new attestation object (validates on serialize). */
export function buildVaultAttestation(params: {
  cid: string;
  sha256: string;
  size: number;
  payer: string;
  memo?: string;
  ts?: number;
}): VaultAttestation {
  const value: VaultAttestation = {
    cid: params.cid,
    sha256: params.sha256.toLowerCase(),
    size: params.size,
    payer: params.payer,
    memo: params.memo ?? "",
    ts: params.ts ?? Date.now(),
  };
  const parsed = parseVaultAttestation(value);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}
