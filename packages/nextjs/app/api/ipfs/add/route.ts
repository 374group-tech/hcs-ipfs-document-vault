import { NextRequest, NextResponse } from "next/server";
import { sha256Hex } from "@vault/ledger";
import { addToIpfs, gatewayUrlFor } from "@/lib/ipfs";

export const runtime = "nodejs";

/**
 * POST multipart file → IPFS (kubo|pinata via IPFS_PROVIDER) → { cid, sha256, size, gatewayUrl }
 * Optional form fields:
 *  - precomputedCid: dry-run without IPFS (no provider required)
 *  - publicAddUrl: alternate public add endpoint (legacy fallback)
 */

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const precomputedCid = String(form.get("precomputedCid") || "");
    const publicAddUrl = String(form.get("publicAddUrl") || "") || undefined;

    let bytes: Uint8Array;
    let filename = "document.bin";

    if (file && typeof file !== "string" && "arrayBuffer" in file) {
      const buf = Buffer.from(await file.arrayBuffer());
      bytes = buf;
      filename = file.name || filename;
    } else if (precomputedCid) {
      bytes = new Uint8Array();
    } else {
      return NextResponse.json(
        { error: "file is required (or pass precomputedCid for dry-run)" },
        { status: 400 },
      );
    }

    const sha256 = bytes.byteLength ? sha256Hex(bytes) : String(form.get("sha256") || "");
    if (!sha256) {
      return NextResponse.json(
        { error: "sha256 required when using empty dry-run body" },
        { status: 400 },
      );
    }

    const mimeType =
      file && typeof file !== "string" && "type" in file && file.type
        ? String(file.type)
        : undefined;

    const added = await addToIpfs(bytes, {
      filename,
      precomputedCid: precomputedCid || undefined,
      publicAddUrl,
      mimeType,
    });

    return NextResponse.json({
      cid: added.cid,
      sha256,
      size: added.size || bytes.byteLength,
      source: added.source,
      gatewayUrl: gatewayUrlFor(added.cid),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
