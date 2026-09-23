import { getVaultEnv, type VaultEnv } from "./env";

export type IpfsProviderName = "kubo" | "pinata";

export type IpfsAddResult = {
  cid: string;
  size: number;
  source: IpfsProviderName | "public-add" | "precomputed";
};

export type IpfsAddOptions = {
  filename?: string;
  precomputedCid?: string;
  /** @deprecated prefer IPFS_PROVIDER=pinata; kept for form-field override */
  publicAddUrl?: string;
  mimeType?: string;
};

/** Abstract IPFS add behind a provider so Kubo and Pinata share one attest path. */
export interface IpfsProvider {
  readonly name: IpfsProviderName;
  add(bytes: Uint8Array, opts?: { filename?: string; mimeType?: string }): Promise<IpfsAddResult>;
}

function resolveProviderName(env: VaultEnv = getVaultEnv()): IpfsProviderName {
  const raw = (env.ipfsProvider || "kubo").trim().toLowerCase();
  if (raw === "pinata") return "pinata";
  return "kubo";
}

export class KuboIpfsProvider implements IpfsProvider {
  readonly name = "kubo" as const;
  constructor(private readonly apiUrl: string) {}

  async add(
    bytes: Uint8Array,
    opts: { filename?: string; mimeType?: string } = {},
  ): Promise<IpfsAddResult> {
    const api = this.apiUrl.replace(/\/$/, "");
    const form = new FormData();
    const blob = new Blob([Buffer.from(bytes)], opts.mimeType ? { type: opts.mimeType } : undefined);
    form.append("file", blob, opts.filename || "document.bin");
    const res = await fetch(`${api}/api/v0/add?pin=true&cid-version=1`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      throw new Error(`Kubo IPFS add failed: ${res.status} ${await res.text()}`);
    }
    const text = await res.text();
    const line = text.trim().split("\n").filter(Boolean).pop() || text;
    const json = JSON.parse(line) as { Hash?: string; cid?: string; Size?: string };
    const cid = json.Hash || json.cid;
    if (!cid) throw new Error("IPFS add response missing Hash/cid");
    return { cid, size: bytes.byteLength, source: "kubo" };
  }
}

/**
 * Pinata pinning API (https://docs.pinata.cloud/api-reference/endpoint/add-file).
 * Auth: PINATA_JWT (Bearer) preferred; or PINATA_API_KEY + PINATA_API_SECRET.
 */
export class PinataIpfsProvider implements IpfsProvider {
  readonly name = "pinata" as const;
  constructor(
    private readonly jwt: string,
    private readonly apiKey: string,
    private readonly apiSecret: string,
    private readonly pinUrl = "https://api.pinata.cloud/pinning/pinFileToIPFS",
  ) {}

  async add(
    bytes: Uint8Array,
    opts: { filename?: string; mimeType?: string } = {},
  ): Promise<IpfsAddResult> {
    if (!this.jwt && !(this.apiKey && this.apiSecret)) {
      throw new Error(
        "Pinata provider selected (IPFS_PROVIDER=pinata) but PINATA_JWT (or PINATA_API_KEY + PINATA_API_SECRET) is missing. See .env.example.",
      );
    }
    const form = new FormData();
    const blob = new Blob([Buffer.from(bytes)], opts.mimeType ? { type: opts.mimeType } : undefined);
    form.append("file", blob, opts.filename || "document.bin");
    const headers: Record<string, string> = {};
    if (this.jwt) {
      headers.Authorization = `Bearer ${this.jwt}`;
    } else {
      headers.pinata_api_key = this.apiKey;
      headers.pinata_secret_api_key = this.apiSecret;
    }
    const res = await fetch(this.pinUrl, { method: "POST", headers, body: form });
    if (!res.ok) {
      throw new Error(`Pinata pinFileToIPFS failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { IpfsHash?: string; Hash?: string; cid?: string };
    const cid = json.IpfsHash || json.Hash || json.cid;
    if (!cid) throw new Error("Pinata response missing IpfsHash/cid");
    return { cid, size: bytes.byteLength, source: "pinata" };
  }
}

export function createIpfsProvider(env: VaultEnv = getVaultEnv()): IpfsProvider {
  const name = resolveProviderName(env);
  if (name === "pinata") {
    return new PinataIpfsProvider(env.pinataJwt, env.pinataApiKey, env.pinataApiSecret);
  }
  return new KuboIpfsProvider(env.ipfsApiUrl);
}

/**
 * Add bytes via the configured IPFS provider (kubo default, or pinata).
 * `precomputedCid` dry-run path works with no provider / no network.
 */
export async function addToIpfs(
  bytes: Uint8Array,
  opts: IpfsAddOptions = {},
): Promise<IpfsAddResult> {
  if (opts.precomputedCid) {
    return { cid: opts.precomputedCid, size: bytes.byteLength, source: "precomputed" };
  }

  const env = getVaultEnv();
  const provider = createIpfsProvider(env);

  try {
    return await provider.add(bytes, { filename: opts.filename, mimeType: opts.mimeType });
  } catch (err) {
    // Optional form-field public add fallback (legacy); primary path is kubo|pinata.
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
    if (provider.name === "kubo") {
      throw new Error(
        `IPFS API unreachable at ${env.ipfsApiUrl}. Start local Kubo (ipfs daemon), set IPFS_PROVIDER=pinata with PINATA_JWT, or pass precomputedCid for dry-run. Cause: ${String(err)}`,
      );
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export function gatewayUrlFor(cid: string): string {
  const env = getVaultEnv();
  const base = env.ipfsGatewayUrl.replace(/\/$/, "");
  return `${base}/${cid}`;
}
