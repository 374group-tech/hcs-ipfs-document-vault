/**
 * Unit tests for IPFS providers (Pinata mocked; Kubo mocked; precomputed dry-run).
 * Run: yarn workspace @vault/nextjs test
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { addToIpfs, PinataIpfsProvider, KuboIpfsProvider } from "./ipfs";

describe("IPFS providers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("precomputedCid skips network and returns source=precomputed", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const bytes = new Uint8Array([1, 2, 3]);
    const result = await addToIpfs(bytes, {
      precomputedCid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    });
    expect(result.source).toBe("precomputed");
    expect(result.cid.startsWith("bafy")).toBe(true);
    expect(result.size).toBe(3);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("PinataIpfsProvider posts multipart and reads IpfsHash (mocked fetch)", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        IpfsHash: "bafkreif7ckqfqbizpthadxlizpgwlgujq6lv3uj26ef2bshy4n2kyd2yny",
        PinSize: 4,
      }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const provider = new PinataIpfsProvider("test-jwt", "", "");
    const result = await provider.add(new Uint8Array([9, 9, 9, 9]), {
      filename: "doc.bin",
      mimeType: "application/octet-stream",
    });

    expect(result.source).toBe("pinata");
    expect(result.cid).toBe("bafkreif7ckqfqbizpthadxlizpgwlgujq6lv3uj26ef2bshy4n2kyd2yny");
    expect(result.size).toBe(4);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("pinata.cloud");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-jwt");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("PinataIpfsProvider throws when credentials missing", async () => {
    const provider = new PinataIpfsProvider("", "", "");
    await expect(provider.add(new Uint8Array([1]))).rejects.toThrow(/PINATA_JWT/);
  });

  it("KuboIpfsProvider parses NDJSON Hash (mocked fetch)", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        '{"Name":"document.bin","Hash":"bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi","Size":"5"}\n',
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const provider = new KuboIpfsProvider("http://127.0.0.1:5001");
    const result = await provider.add(new Uint8Array([1, 2, 3, 4, 5]), {
      filename: "document.bin",
    });
    expect(result.source).toBe("kubo");
    expect(result.cid.startsWith("bafy")).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain("/api/v0/add");
  });
});
