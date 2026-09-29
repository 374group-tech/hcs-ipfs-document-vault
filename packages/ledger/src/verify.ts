import {
  hashScanTopicMessageUrl,
  formatConsensusTimestamp,
  type HashScanNetwork,
} from "./hashscan";
import { parseVaultAttestation, type VaultAttestation } from "./schema";

/** Minimal Mirror Node topic message shape used by verify. */
export type MirrorMessageLike = {
  consensus_timestamp: string;
  topic_id?: string;
  message: string;
  sequence_number: number;
  running_hash?: string;
  payer_account_id?: string;
};

/**
 * `payer` inside the JSON is self-declared by whoever submitted the message; Mirror Node's
 * `payer_account_id` is the account that actually paid for (signed) the transaction.
 * - match: they agree
 * - mismatch: someone else posted a message claiming this payer (flag as untrusted)
 * - unknown: Mirror response did not include payer_account_id
 */
export type PayerCheck = "match" | "mismatch" | "unknown";

export function checkPayer(declaredPayer: string, mirrorPayer?: string): PayerCheck {
  if (!mirrorPayer) return "unknown";
  return declaredPayer === mirrorPayer ? "match" : "mismatch";
}

export type CidMatch = {
  attestation: VaultAttestation;
  payerCheck: PayerCheck;
  topicId: string;
  sequenceNumber: number;
  consensusTimestamp: string;
  consensusTimestampIso: string;
  payerAccountId?: string;
  runningHash?: string;
  hashScanUrl: string;
  raw: string;
};

/** Decode Mirror Node base64 HCS message payload to UTF-8. */
export function decodeHcsMessageBase64(messageBase64: string): string {
  return Buffer.from(messageBase64, "base64").toString("utf8");
}

/**
 * Parse one Mirror message into a CID match payload, or null if not a vault attestation.
 * Accepts legacy (no schemaVersion) and schema v1 messages.
 */
export function matchFromMirrorMessage(
  m: MirrorMessageLike,
  opts: { topicId: string; network?: HashScanNetwork },
): CidMatch | null {
  const decoded = decodeHcsMessageBase64(m.message);
  const parsed = parseVaultAttestation(decoded);
  if (!parsed.ok) return null;
  const topicId = m.topic_id || opts.topicId;
  const seq = m.sequence_number;
  const network = opts.network ?? "testnet";
  return {
    attestation: parsed.value,
    payerCheck: checkPayer(parsed.value.payer, m.payer_account_id),
    topicId,
    sequenceNumber: seq,
    consensusTimestamp: m.consensus_timestamp,
    consensusTimestampIso: formatConsensusTimestamp(m.consensus_timestamp),
    payerAccountId: m.payer_account_id,
    runningHash: m.running_hash,
    hashScanUrl: hashScanTopicMessageUrl(topicId, seq, network, m.consensus_timestamp),
    raw: decoded,
  };
}

/** Filter Mirror messages for attestations whose cid equals `cid`. */
export function findCidMatches(
  messages: MirrorMessageLike[],
  cid: string,
  opts: { topicId: string; network?: HashScanNetwork },
): CidMatch[] {
  const out: CidMatch[] = [];
  for (const m of messages) {
    const match = matchFromMirrorMessage(m, opts);
    if (match && match.attestation.cid === cid) out.push(match);
  }
  return out;
}

/** Mirror Node list response (`GET /api/v1/topics/{id}/messages`). */
export type MirrorMessagesPage<M extends MirrorMessageLike = MirrorMessageLike> = {
  messages?: M[];
  links?: { next?: string | null };
};

export type PagedMessages<M extends MirrorMessageLike = MirrorMessageLike> = {
  messages: M[];
  pages: number;
  /** true when maxPages was reached while Mirror still returned a `links.next`. */
  truncated: boolean;
};

export const DEFAULT_MIRROR_MAX_PAGES = 50;

/**
 * Follow Mirror Node `links.next` (a path relative to the Mirror base URL) until exhausted
 * or `maxPages` is reached. `fetchPage` returns the parsed JSON for one URL.
 */
export async function collectMirrorPages<M extends MirrorMessageLike>(
  firstUrl: string,
  fetchPage: (url: string) => Promise<MirrorMessagesPage<M>>,
  opts: { maxPages?: number } = {},
): Promise<PagedMessages<M>> {
  const maxPages = opts.maxPages ?? DEFAULT_MIRROR_MAX_PAGES;
  const messages: M[] = [];
  let url: string | null = firstUrl;
  let pages = 0;
  while (url && pages < maxPages) {
    const page: MirrorMessagesPage<M> = await fetchPage(url);
    pages++;
    messages.push(...(page.messages ?? []));
    const next = page.links?.next;
    url = next ? new URL(next, firstUrl).toString() : null;
  }
  return { messages, pages, truncated: url !== null };
}
