import { getVaultEnv } from "./env";

export type IpfsAddResult = {
  cid: string;
  size: number;
  source: "kubo" | "public-add" | "precomputed";
};

/**
 * Add bytes to a configurable IPFS HTTP API (Kubo default :5001).
 * Without a reachable IPFS API the vault has nowhere for bytes — use
 * `precomputedCid` for dry-run attestations only.
 */
export async function addToIpfs(
  bytes: Uint8Array,
  opts: { filename?: string; precomputedCid?: string; publicAddUrl?: string } = {},
): Promise<IpfsAddResult> {
  if (opts.precomputedCid) {
    return { cid: opts.precomputedCid, size: bytes.byteLength, source: "precomputed" };
  }

  const env = getVaultEnv();
  const api = env.ipfsApiUrl.replace(/\/$/, "");

  // Kubo HTTP API: POST /api/v0/add
  try {
    const form = new FormData();
    const blob = new Blob([Buffer.from(bytes)]);
    form.append("file", blob, opts.filename || "document.bin");
    const res = await fetch(`${api}/api/v0/add?pin=true&cid-version=1`, {
      method: "POST",
      body: form,
    });
    if (res.ok) {
      const text = await res.text();
      // Kubo may return NDJSON; take last/first object
      const line = text.trim().split("\n").filter(Boolean).pop() || text;
      const json = JSON.parse(line) as { Hash?: string; cid?: string; Size?: string };
      const cid = json.Hash || json.cid;
      if (!cid) throw new Error("IPFS add response missing Hash/cid");
      return {
        cid,
        size: bytes.byteLength,
        source: "kubo",
      };
    }
  } catch (err) {
    // fall through to public add if configured
    if (!opts.publicAddUrl) {
      throw new Error(
        `IPFS API unreachable at ${api}. Start local Kubo (ipfs daemon) or pass precomputedCid for dry-run. Cause: ${String(err)}`,
      );
    }
  }

  if (opts.publicAddUrl) {
    const form = new FormData();
    form.append("file", new Blob([Buffer.from(bytes)]), opts.filename || "document.bin");
    const res = await fetch(opts.publicAddUrl, { method: "POST", body: form });
    if (!res.ok) {
      throw new Error(`Public IPFS add failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { Hash?: string; cid?: string };
    const cid = json.Hash || json.cid;
    if (!cid) throw new Error("Public IPFS add missing cid");
    return { cid, size: bytes.byteLength, source: "public-add" };
  }

  throw new Error(
    `IPFS API unreachable at ${api}. Without IPFS the vault has nowhere for bytes. Start Kubo or pass precomputedCid.`,
  );
}

export function gatewayUrlFor(cid: string): string {
  const env = getVaultEnv();
  const base = env.ipfsGatewayUrl.replace(/\/$/, "");
  return `${base}/${cid}`;
}
