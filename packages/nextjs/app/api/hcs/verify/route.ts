import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_MAX_CONTENT_BYTES,
  hashScanTopicUrl,
  ipfsGatewayUrl,
  mirrorTopicMessagesUrl,
  mirrorTopicMessageUrl,
} from "@vault/ledger";
import { getVaultEnv } from "@/lib/env";
import { EXIT_CODES, verifyVaultCid, type ContentInput } from "@/lib/vault-verify";

export const runtime = "nodejs";

type VerifyParams = { cid: string; topicId: string; sequence: string };

async function respond(params: VerifyParams, content: ContentInput) {
  const env = getVaultEnv();
  const topicId = params.topicId || env.topicId;
  if (!topicId) {
    return NextResponse.json({ error: "topicId required (query or HCS_TOPIC_ID)" }, { status: 400 });
  }
  if (!params.cid && !params.sequence) {
    return NextResponse.json({ error: "cid and/or sequence required" }, { status: 400 });
  }
  let sequence: number | undefined;
  if (params.sequence) {
    sequence = Number(params.sequence);
    if (!Number.isInteger(sequence) || sequence < 1) {
      return NextResponse.json({ error: "sequence must be a positive integer" }, { status: 400 });
    }
  }

  const result = await verifyVaultCid({ cid: params.cid, topicId, sequence, content, env });
  return NextResponse.json({
    ...result,
    matchCount: result.matches.length,
    exitCode: EXIT_CODES[result.verdict],
    matches: result.matches.map((m) => ({
      ...m,
      mirrorMessageUrl: mirrorTopicMessageUrl(topicId, m.sequenceNumber, env.mirrorNodeUrl),
      ipfsGatewayUrl: ipfsGatewayUrl(m.attestation.cid, env.ipfsGatewayUrl),
    })),
    mirror: {
      baseUrl: env.mirrorNodeUrl,
      listUrl: mirrorTopicMessagesUrl(topicId, { networkOrUrl: env.mirrorNodeUrl }),
      messageUrl: sequence ? mirrorTopicMessageUrl(topicId, sequence, env.mirrorNodeUrl) : null,
    },
    hashScanTopicUrl: hashScanTopicUrl(topicId, env.network),
  });
}

function errorResponse(err: unknown) {
  return NextResponse.json(
    { error: err instanceof Error ? err.message : String(err) },
    { status: 500 },
  );
}

/**
 * GET ?cid=…&topicId=…&sequence=…&content=skip
 * Mirror Node lookup (legacy + schema v1), payer check, then downloads the CID from IPFS
 * gateways and compares sha256 (and raw CIDs) to the HCS anchor. `content=skip` = HCS only.
 */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const params = {
      cid: (q.get("cid") || "").trim(),
      topicId: (q.get("topicId") || "").trim(),
      sequence: (q.get("sequence") || "").trim(),
    };
    return await respond(params, q.get("content") === "skip" ? { mode: "skip" } : { mode: "gateway" });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST multipart { file, cid?, topicId?, sequence? }: compare a local copy of the document
 * with the HCS anchor instead of downloading it (e.g. to prove a received file is untampered).
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (file.size > DEFAULT_MAX_CONTENT_BYTES) {
      return NextResponse.json({ error: "file too large" }, { status: 413 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const params = {
      cid: String(form.get("cid") || "").trim(),
      topicId: String(form.get("topicId") || "").trim(),
      sequence: String(form.get("sequence") || "").trim(),
    };
    return await respond(params, {
      mode: "bytes",
      bytes,
      source: { kind: "file", path: file.name || "upload" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
