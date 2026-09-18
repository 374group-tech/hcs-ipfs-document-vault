import { NextRequest, NextResponse } from "next/server";
import { parseVaultAttestation, hashScanTopicMessageUrl, ipfsGatewayUrl } from "@vault/ledger";
import { decodeMirrorMessage, fetchTopicMessages } from "@/lib/hedera";
import { getVaultEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * GET ?cid=...&topicId=... → Mirror Node scan for matching attestation
 */
export async function GET(req: NextRequest) {
  try {
    const env = getVaultEnv();
    const cid = req.nextUrl.searchParams.get("cid") || "";
    const topicId = req.nextUrl.searchParams.get("topicId") || env.topicId;
    if (!cid) {
      return NextResponse.json({ error: "cid query param required" }, { status: 400 });
    }
    if (!topicId) {
      return NextResponse.json({ error: "topicId required (query or HCS_TOPIC_ID)" }, { status: 400 });
    }

    const messages = await fetchTopicMessages(topicId, { limit: 100, order: "desc" });
    const matches = [];
    for (const m of messages) {
      const decoded = decodeMirrorMessage(m.message);
      const parsed = parseVaultAttestation(decoded);
      if (!parsed.ok) continue;
      if (parsed.value.cid === cid) {
        matches.push({
          attestation: parsed.value,
          sequenceNumber: m.sequence_number,
          consensusTimestamp: m.consensus_timestamp,
          payerAccountId: m.payer_account_id,
          hashScanUrl: hashScanTopicMessageUrl(topicId, m.sequence_number, env.network),
          ipfsGatewayUrl: ipfsGatewayUrl(cid, env.ipfsGatewayUrl),
          raw: decoded,
        });
      }
    }

    return NextResponse.json({
      topicId,
      cid,
      matchCount: matches.length,
      matches,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
