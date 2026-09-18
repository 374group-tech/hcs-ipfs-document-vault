import { NextRequest, NextResponse } from "next/server";
import { submitAttestation } from "@/lib/hedera";

export const runtime = "nodejs";

/**
 * POST JSON { cid, sha256, size, memo?, topicId? } → HCS TopicMessageSubmit
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      cid?: string;
      sha256?: string;
      size?: number;
      memo?: string;
      topicId?: string;
    };
    if (!body.cid || !body.sha256 || typeof body.size !== "number") {
      return NextResponse.json(
        { error: "cid, sha256, and size are required" },
        { status: 400 },
      );
    }
    const result = await submitAttestation({
      cid: body.cid,
      sha256: body.sha256,
      size: body.size,
      memo: body.memo,
      topicId: body.topicId,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
