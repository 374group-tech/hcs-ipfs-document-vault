import { NextRequest, NextResponse } from "next/server";
import {
  hashScanTopicUrl,
  ipfsGatewayUrl,
  mirrorTopicMessageUrl,
  mirrorTopicMessagesUrl,
  matchFromMirrorMessage,
  type CidMatch,
} from "@vault/ledger";
import {
  fetchTopicMessages,
  fetchTopicMessageBySequence,
} from "@/lib/hedera";
import { getVaultEnv } from "@/lib/env";

export const runtime = "nodejs";

type MatchPayload = CidMatch & {
  hashScanTopicUrl: string;
  mirrorMessageUrl: string;
  ipfsGatewayUrl: string;
};

function enrich(
  match: CidMatch,
  topicId: string,
  network: string,
  mirrorNodeUrl: string,
  gateway: string,
): MatchPayload {
  return {
    ...match,
    hashScanTopicUrl: hashScanTopicUrl(topicId, network),
    mirrorMessageUrl: mirrorTopicMessageUrl(topicId, match.sequenceNumber, mirrorNodeUrl),
    ipfsGatewayUrl: ipfsGatewayUrl(match.attestation.cid, gateway),
  };
}

/**
 * GET ?cid=...&topicId=...&sequence=... → Mirror Node verify
 * Accepts legacy attestations and schema v1 (schemaVersion / mime / prevCid).
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
        const base = matchFromMirrorMessage(msg, { topicId, network: env.network });
        if (base) {
          const match = enrich(base, topicId, env.network, env.mirrorNodeUrl, env.ipfsGatewayUrl);
          if (!cid || match.attestation.cid === cid) {
            matches.push(match);
          } else if (cid && match.attestation.cid !== cid) {
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
      }
    } else {
      const messages = await fetchTopicMessages(topicId, { limit: 100, order: "desc" });
      scannedCount = messages.length;
      for (const m of messages) {
        const base = matchFromMirrorMessage(m, { topicId, network: env.network });
        if (!base) continue;
        if (base.attestation.cid === cid) {
          matches.push(enrich(base, topicId, env.network, env.mirrorNodeUrl, env.ipfsGatewayUrl));
        }
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
