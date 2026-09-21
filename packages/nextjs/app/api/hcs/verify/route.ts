import { NextRequest, NextResponse } from "next/server";
import {
  parseVaultAttestation,
  hashScanTopicMessageUrl,
  hashScanTopicUrl,
  ipfsGatewayUrl,
  mirrorTopicMessageUrl,
  mirrorTopicMessagesUrl,
  formatConsensusTimestamp,
} from "@vault/ledger";
import {
  decodeMirrorMessage,
  fetchTopicMessages,
  fetchTopicMessageBySequence,
  type MirrorTopicMessage,
} from "@/lib/hedera";
import { getVaultEnv } from "@/lib/env";

export const runtime = "nodejs";

type MatchPayload = {
  attestation: {
    cid: string;
    sha256: string;
    size: number;
    payer: string;
    memo: string;
    ts: number;
  };
  topicId: string;
  sequenceNumber: number;
  consensusTimestamp: string;
  consensusTimestampIso: string;
  payerAccountId?: string;
  runningHash?: string;
  hashScanUrl: string;
  hashScanTopicUrl: string;
  mirrorMessageUrl: string;
  ipfsGatewayUrl: string;
  raw: string;
};

function toMatch(
  m: MirrorTopicMessage,
  topicId: string,
  network: string,
  mirrorNodeUrl: string,
  gateway: string,
): MatchPayload | null {
  const decoded = decodeMirrorMessage(m.message);
  const parsed = parseVaultAttestation(decoded);
  if (!parsed.ok) return null;
  const seq = m.sequence_number;
  return {
    attestation: parsed.value,
    topicId: m.topic_id || topicId,
    sequenceNumber: seq,
    consensusTimestamp: m.consensus_timestamp,
    consensusTimestampIso: formatConsensusTimestamp(m.consensus_timestamp),
    payerAccountId: m.payer_account_id,
    runningHash: m.running_hash,
    hashScanUrl: hashScanTopicMessageUrl(topicId, seq, network),
    hashScanTopicUrl: hashScanTopicUrl(topicId, network),
    mirrorMessageUrl: mirrorTopicMessageUrl(topicId, seq, mirrorNodeUrl),
    ipfsGatewayUrl: ipfsGatewayUrl(parsed.value.cid, gateway),
    raw: decoded,
  };
}

/**
 * GET ?cid=...&topicId=...&sequence=... → Mirror Node verify
 * - With sequence: fetch that message directly, then filter by cid if provided.
 * - Without sequence: scan recent topic messages for cid match.
 */
export async function GET(req: NextRequest) {
  try {
    const env = getVaultEnv();
    const cid = (req.nextUrl.searchParams.get("cid") || "").trim();
    const sequenceParam = (req.nextUrl.searchParams.get("sequence") || "").trim();
    const topicId = (req.nextUrl.searchParams.get("topicId") || env.topicId).trim();

    if (!topicId) {
      return NextResponse.json(
        { error: "topicId required (query or HCS_TOPIC_ID)" },
        { status: 400 },
      );
    }
    if (!cid && !sequenceParam) {
      return NextResponse.json(
        { error: "cid and/or sequence query param required" },
        { status: 400 },
      );
    }

    const matches: MatchPayload[] = [];
    let scannedCount = 0;
    let mode: "sequence" | "scan" = "scan";

    if (sequenceParam) {
      mode = "sequence";
      const seqNum = Number(sequenceParam);
      if (!Number.isFinite(seqNum) || seqNum < 1) {
        return NextResponse.json({ error: "sequence must be a positive integer" }, { status: 400 });
      }
      const msg = await fetchTopicMessageBySequence(topicId, seqNum);
      scannedCount = msg ? 1 : 0;
      if (msg) {
        const match = toMatch(msg, topicId, env.network, env.mirrorNodeUrl, env.ipfsGatewayUrl);
        if (match && (!cid || match.attestation.cid === cid)) {
          matches.push(match);
        } else if (match && cid && match.attestation.cid !== cid) {
          return NextResponse.json({
            topicId,
            cid: cid || null,
            sequence: seqNum,
            mode,
            matchCount: 0,
            scannedCount,
            matches: [],
            mismatch: {
              expectedCid: cid,
              foundCid: match.attestation.cid,
              sequenceNumber: match.sequenceNumber,
              hashScanUrl: match.hashScanUrl,
            },
            mirror: {
              baseUrl: env.mirrorNodeUrl,
              listUrl: mirrorTopicMessagesUrl(topicId, { networkOrUrl: env.mirrorNodeUrl }),
              messageUrl: mirrorTopicMessageUrl(topicId, seqNum, env.mirrorNodeUrl),
            },
            hashScanTopicUrl: hashScanTopicUrl(topicId, env.network),
          });
        }
      }
    } else {
      const messages = await fetchTopicMessages(topicId, { limit: 100, order: "desc" });
      scannedCount = messages.length;
      for (const m of messages) {
        const match = toMatch(m, topicId, env.network, env.mirrorNodeUrl, env.ipfsGatewayUrl);
        if (!match) continue;
        if (match.attestation.cid === cid) matches.push(match);
      }
    }

    return NextResponse.json({
      topicId,
      cid: cid || null,
      sequence: sequenceParam ? Number(sequenceParam) : null,
      mode,
      matchCount: matches.length,
      scannedCount,
      matches,
      mirror: {
        baseUrl: env.mirrorNodeUrl,
        listUrl: mirrorTopicMessagesUrl(topicId, {
          networkOrUrl: env.mirrorNodeUrl,
          limit: 100,
          order: "desc",
        }),
        messageUrl: sequenceParam
          ? mirrorTopicMessageUrl(topicId, sequenceParam, env.mirrorNodeUrl)
          : null,
      },
      hashScanTopicUrl: hashScanTopicUrl(topicId, env.network),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
