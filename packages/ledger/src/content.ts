import { CID } from "multiformats/cid";
import * as Digest from "multiformats/hashes/digest";
import * as raw from "multiformats/codecs/raw";
import { sha256Hex } from "./hash";
import { ipfsGatewayUrl } from "./hashscan";
import type { VaultAttestation } from "./schema";

/** multicodec codes used below (https://github.com/multiformats/multicodec). */
const CODEC_RAW = raw.code; // 0x55
const CODEC_DAG_PB = 0x70;
const MULTIHASH_SHA2_256 = 0x12;

/** Public gateways tried after IPFS_GATEWAY_URL (path-style `/ipfs/<cid>` bases). */
export const DEFAULT_IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs",
  "https://dweb.link/ipfs",
  "https://w3s.link/ipfs",
] as const;

export const DEFAULT_GATEWAY_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_CONTENT_BYTES = 25 * 1024 * 1024;

export type CidCheck =
  | { status: "match"; computedCid: string }
  | { status: "mismatch"; computedCid: string }
  | { status: "not-recomputable"; reason: string };

/**
 * Recompute a CID from bytes and compare it to `cid`.
 * Only CIDv1 `raw` + sha2-256 (`bafkrei…`) is a pure function of the bytes. dag-pb/UnixFS
 * CIDs (`Qm…`, `bafybei…`) depend on the chunker and DAG layout the adder used, so they are
 * reported as not recomputable instead of claiming a match.
 */
export function recomputeCid(cid: string, bytes: Uint8Array): CidCheck {
  let parsed: CID;
  try {
    parsed = CID.parse(cid);
  } catch {
    return { status: "not-recomputable", reason: "not a parseable CID" };
  }
  if (parsed.code === CODEC_RAW && parsed.multihash.code === MULTIHASH_SHA2_256) {
    const digest = Digest.create(MULTIHASH_SHA2_256, Buffer.from(sha256Hex(bytes), "hex"));
    const computed = CID.createV1(CODEC_RAW, digest);
    return {
      status: computed.equals(parsed) ? "match" : "mismatch",
      computedCid: computed.toString(),
    };
  }
  if (parsed.code === CODEC_DAG_PB) {
    return {
      status: "not-recomputable",
      reason:
        "dag-pb/UnixFS CID depends on the adder's chunker and layout; only sha256 of the bytes was checked",
    };
  }
  return {
    status: "not-recomputable",
    reason: `codec 0x${parsed.code.toString(16)} / multihash 0x${parsed.multihash.code.toString(16)} not supported; only sha256 was checked`,
  };
}

/**
 * For raw sha2-256 CIDs the multihash digest *is* sha256(bytes). Returns true/false when the
 * attestation's `cid` and `sha256` agree, or null when the CID type does not embed the file hash.
 */
export function cidDigestMatchesSha256(cid: string, sha256: string): boolean | null {
  try {
    const parsed = CID.parse(cid);
    if (parsed.code !== CODEC_RAW || parsed.multihash.code !== MULTIHASH_SHA2_256) return null;
    return Buffer.from(parsed.multihash.digest).toString("hex") === sha256.toLowerCase();
  } catch {
    return null;
  }
}

export type ContentState = "match" | "hash-mismatch" | "unavailable";

export type GatewayAttempt = { url: string; error: string };

export type ContentSource = { kind: "gateway"; url: string } | { kind: "file"; path: string };

export type ContentVerification =
  | {
      state: "match" | "hash-mismatch";
      source: ContentSource;
      expectedSha256: string;
      computedSha256: string;
      expectedSize: number;
      actualSize: number;
      cid: CidCheck;
      attempts: GatewayAttempt[];
    }
  | { state: "unavailable"; expectedSha256: string; attempts: GatewayAttempt[] };

/** Compare bytes against an attestation: sha256 must match and a recomputable CID must not differ. */
export function verifyContentBytes(
  bytes: Uint8Array,
  attestation: Pick<VaultAttestation, "cid" | "sha256" | "size">,
  source: ContentSource,
  attempts: GatewayAttempt[] = [],
): ContentVerification {
  const computedSha256 = sha256Hex(bytes);
  const cid = recomputeCid(attestation.cid, bytes);
  const shaOk = computedSha256 === attestation.sha256.toLowerCase();
  return {
    state: shaOk && cid.status !== "mismatch" ? "match" : "hash-mismatch",
    source,
    expectedSha256: attestation.sha256.toLowerCase(),
    computedSha256,
    expectedSize: attestation.size,
    actualSize: bytes.byteLength,
    cid,
    attempts,
  };
}

/** Ordered, de-duplicated gateway list: primary first, then extras (CSV), then defaults. */
export function resolveGateways(primary?: string, extraCsv?: string): string[] {
  const all = [
    primary,
    ...(extraCsv ? extraCsv.split(",") : []),
    ...DEFAULT_IPFS_GATEWAYS,
  ];
  const out: string[] = [];
  for (const g of all) {
    const v = (g || "").trim().replace(/\/$/, "");
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

export type GatewayFetchResult =
  | { ok: true; bytes: Uint8Array; url: string; attempts: GatewayAttempt[] }
  | { ok: false; attempts: GatewayAttempt[] };

/** Try each gateway in order with a per-request timeout and a size cap; first 2xx wins. */
export async function fetchFromGateways(
  cid: string,
  gateways: string[],
  opts: { timeoutMs?: number; maxBytes?: number; fetchImpl?: FetchLike } = {},
): Promise<GatewayFetchResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_GATEWAY_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_CONTENT_BYTES;
  const doFetch: FetchLike = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  const attempts: GatewayAttempt[] = [];

  for (const gateway of gateways) {
    const url = ipfsGatewayUrl(cid, gateway);
    try {
      const res = await doFetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        attempts.push({ url, error: `HTTP ${res.status}` });
        continue;
      }
      const declared = Number(res.headers.get("content-length") ?? "");
      if (Number.isFinite(declared) && declared > maxBytes) {
        attempts.push({ url, error: `content-length ${declared} exceeds ${maxBytes} bytes` });
        continue;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength > maxBytes) {
        attempts.push({ url, error: `body exceeds ${maxBytes} bytes` });
        continue;
      }
      return { ok: true, bytes, url, attempts };
    } catch (err) {
      const e = err as { name?: string; message?: string };
      const msg =
        e?.name === "TimeoutError" || e?.name === "AbortError"
          ? `timeout after ${timeoutMs} ms`
          : e?.message || String(err);
      attempts.push({ url, error: msg });
    }
  }
  return { ok: false, attempts };
}

/** Download the attested CID from gateways and verify the bytes against the HCS-anchored sha256. */
export async function verifyAttestedContent(
  attestation: Pick<VaultAttestation, "cid" | "sha256" | "size">,
  gateways: string[],
  opts: { timeoutMs?: number; maxBytes?: number; fetchImpl?: FetchLike } = {},
): Promise<ContentVerification> {
  const fetched = await fetchFromGateways(attestation.cid, gateways, opts);
  if (!fetched.ok) {
    return {
      state: "unavailable",
      expectedSha256: attestation.sha256.toLowerCase(),
      attempts: fetched.attempts,
    };
  }
  return verifyContentBytes(
    fetched.bytes,
    attestation,
    { kind: "gateway", url: fetched.url },
    fetched.attempts,
  );
}
