import { NextRequest, NextResponse } from "next/server";
import { createVaultTopic } from "@/lib/hedera";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    let memo = "hcs-ipfs-document-vault";
    try {
      const body = (await req.json()) as { memo?: string };
      if (body.memo) memo = body.memo;
    } catch {
      // empty body ok
    }
    const result = await createVaultTopic(memo);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
