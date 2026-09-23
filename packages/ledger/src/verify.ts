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

export type CidMatch = {
  attestation: VaultAttestation;
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
    topicId,
    sequenceNumber: seq,
    consensusTimestamp: m.consensus_timestamp,
    consensusTimestampIso: formatConsensusTimestamp(m.consensus_timestamp),
    payerAccountId: m.payer_account_id,
    runningHash: m.running_hash,
    hashScanUrl: hashScanTopicMessageUrl(topicId, seq, network),
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
