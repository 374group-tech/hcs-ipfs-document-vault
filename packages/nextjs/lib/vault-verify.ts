/**
 * Shared verify pipeline for `yarn verify:proof` and `/api/hcs/verify`:
 * 1. find the CID's attestation on HCS via Mirror Node (by sequence, or paging all messages)
 * 2. compare the self-declared `payer` to Mirror `payer_account_id`
 * 3. trustless content check: bytes (gateway download or a local file) → sha256 (+ raw CID)
 *    compared to the sha256 anchored on HCS.
 */
import {
  fetchFromGateways,
  matchFromMirrorMessage,
  resolveGateways,
  verifyContentBytes,
  type CidMatch,
  type ContentSource,
  type ContentVerification,
  type GatewayAttempt,
} from "@vault/ledger";
import { getVaultEnv, type VaultEnv } from "./env";
import { fetchTopicMessageBySequence, fetchTopicMessages } from "./hedera";

export type ContentInput =
  | { mode: "gateway" }
  | { mode: "skip" }
  | { mode: "bytes"; bytes: Uint8Array; source: ContentSource };

export type Verdict =
  | "match"
  | "hcs-only"
  | "hash-mismatch"
  | "payer-mismatch"
  | "content-unavailable"
  | "not-anchored";

export type VerifiedMatch = CidMatch & { content?: ContentVerification };

export type VaultVerifyResult = {
  topicId: string;
  cid: string | null;
  sequence: number | null;
  mode: "sequence" | "scan";
  scannedCount: number;
  pages: number;
  truncated: boolean;
  matches: VerifiedMatch[];
  /** Newest match whose payer is not flagged (else newest); drives `verdict`. */
  primary: VerifiedMatch | null;
  mismatch?: { expectedCid: string; foundCid: string; sequenceNumber: number; hashScanUrl: string };
  verdict: Verdict;
};

/** CLI exit code per verdict (documented in README "Verify states"). */
export const EXIT_CODES: Record<Verdict, number> = {
  match: 0,
  "hcs-only": 0,
  "not-anchored": 1,
  "hash-mismatch": 2,
  "content-unavailable": 3,
  "payer-mismatch": 4,
};

function pickPrimary(matches: VerifiedMatch[]): VerifiedMatch | null {
  return matches.find((m) => m.payerCheck !== "mismatch") ?? matches[0] ?? null;
}

export function verdictFor(primary: VerifiedMatch | null): Verdict {
  if (!primary) return "not-anchored";
  if (primary.content?.state === "hash-mismatch") return "hash-mismatch";
  if (primary.payerCheck === "mismatch") return "payer-mismatch";
  if (primary.content?.state === "unavailable") return "content-unavailable";
  if (primary.content?.state === "match") return "match";
  return "hcs-only";
}

async function attachContent(
  matches: VerifiedMatch[],
  input: ContentInput,
  env: VaultEnv,
): Promise<void> {
  if (input.mode === "skip" || matches.length === 0) return;
  let bytes: Uint8Array | null = null;
  let source: ContentSource | null = null;
  let attempts: GatewayAttempt[] = [];
  if (input.mode === "bytes") {
    bytes = input.bytes;
    source = input.source;
  } else {
    // Same CID for every match: download once, then compare against each anchored sha256.
    const gateways = resolveGateways(env.ipfsGatewayUrl, env.ipfsGatewayFallbacks);
    const fetched = await fetchFromGateways(matches[0].attestation.cid, gateways, {
      timeoutMs: env.ipfsGatewayTimeoutMs,
    });
    attempts = fetched.attempts;
    if (fetched.ok) {
      bytes = fetched.bytes;
      source = { kind: "gateway", url: fetched.url };
    }
  }
  for (const m of matches) {
    m.content =
      bytes && source
        ? verifyContentBytes(bytes, m.attestation, source, attempts)
        : { state: "unavailable", expectedSha256: m.attestation.sha256, attempts };
  }
}

export async function verifyVaultCid(params: {
  cid?: string;
  topicId: string;
  sequence?: number;
  content: ContentInput;
  maxPages?: number;
  env?: VaultEnv;
}): Promise<VaultVerifyResult> {
  const env = params.env ?? getVaultEnv();
  const { topicId } = params;
  const cid = params.cid?.trim() || null;
  const opts = { topicId, network: env.network };
  const base = {
    topicId,
    cid,
    sequence: params.sequence ?? null,
    mode: params.sequence ? ("sequence" as const) : ("scan" as const),
  };

  let matches: VerifiedMatch[] = [];
  let scannedCount = 0;
  let pages = 0;
  let truncated = false;

  if (params.sequence) {
    const msg = await fetchTopicMessageBySequence(topicId, params.sequence, env.mirrorNodeUrl);
    scannedCount = msg ? 1 : 0;
    pages = 1;
    const match = msg ? matchFromMirrorMessage(msg, opts) : null;
    if (match && cid && match.attestation.cid !== cid) {
      return {
        ...base,
        scannedCount,
        pages,
        truncated,
        matches: [],
        primary: null,
        mismatch: {
          expectedCid: cid,
          foundCid: match.attestation.cid,
          sequenceNumber: match.sequenceNumber,
          hashScanUrl: match.hashScanUrl,
        },
        verdict: "not-anchored",
      };
    }
    if (match) matches = [match];
  } else {
    if (!cid) throw new Error("cid is required unless sequence is set");
    const paged = await fetchTopicMessages(topicId, {
      order: "desc",
      maxPages: params.maxPages,
      mirrorNodeUrl: env.mirrorNodeUrl,
    });
    scannedCount = paged.messages.length;
    pages = paged.pages;
    truncated = paged.truncated;
    for (const m of paged.messages) {
      const match = matchFromMirrorMessage(m, opts);
      if (match && match.attestation.cid === cid) matches.push(match);
    }
  }

  await attachContent(matches, params.content, env);
  const primary = pickPrimary(matches);
  return {
    ...base,
    scannedCount,
    pages,
    truncated,
    matches,
    primary,
    verdict: verdictFor(primary),
  };
}
