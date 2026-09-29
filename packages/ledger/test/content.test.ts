import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  cidDigestMatchesSha256,
  fetchFromGateways,
  recomputeCid,
  resolveGateways,
  verifyAttestedContent,
  verifyContentBytes,
  type FetchLike,
} from "../src/content";

// Real testnet anchor: topic 0.0.10600873 seq 5 (schema v1).
const SEQ5 = {
  cid: "bafkreihbeveqd5e6z7sry2zjyxqfzzjcoc6efxnj4isnb47tyt5xnedlru",
  sha256: "e1254901f49ecfe51c6b29c5e05ce52270bc42dda9e224d0f3f3c4fb76906b8d",
  size: 61,
};
const examples = resolve(__dirname, "../../../docs/examples");
const original = readFileSync(resolve(examples, "agreement-seq5.txt"));
const tampered = readFileSync(resolve(examples, "agreement-seq5-tampered.txt"));
const fileSource = { kind: "file" as const, path: "x" };

function response(body: Uint8Array | string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

describe("recomputeCid", () => {
  it("recomputes a raw sha2-256 CIDv1 from the bundled seq 5 bytes", () => {
    expect(recomputeCid(SEQ5.cid, original)).toEqual({ status: "match", computedCid: SEQ5.cid });
  });

  it("reports mismatch for tampered bytes", () => {
    const r = recomputeCid(SEQ5.cid, tampered);
    expect(r.status).toBe("mismatch");
  });

  it("refuses to claim a match for dag-pb CIDs (v0 and v1)", () => {
    for (const cid of [
      "QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn",
      "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    ]) {
      const r = recomputeCid(cid, original);
      expect(r.status).toBe("not-recomputable");
    }
  });

  it("reports unparseable CIDs as not recomputable", () => {
    expect(recomputeCid("not-a-cid", original).status).toBe("not-recomputable");
  });
});

describe("cidDigestMatchesSha256", () => {
  it("is true when a raw CID embeds the anchored sha256", () => {
    expect(cidDigestMatchesSha256(SEQ5.cid, SEQ5.sha256)).toBe(true);
    expect(cidDigestMatchesSha256(SEQ5.cid, "0".repeat(64))).toBe(false);
  });
  it("is null for dag-pb CIDs", () => {
    expect(
      cidDigestMatchesSha256("QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn", SEQ5.sha256),
    ).toBeNull();
  });
});

describe("verifyContentBytes", () => {
  it("matches the original bundled file", () => {
    const r = verifyContentBytes(original, SEQ5, fileSource);
    expect(r.state).toBe("match");
    if (r.state === "unavailable") throw new Error("unreachable");
    expect(r.computedSha256).toBe(SEQ5.sha256);
    expect(r.actualSize).toBe(SEQ5.size);
  });

  it("fails clearly on the bundled tampered file", () => {
    const r = verifyContentBytes(tampered, SEQ5, fileSource);
    expect(r.state).toBe("hash-mismatch");
    if (r.state === "unavailable") throw new Error("unreachable");
    expect(r.computedSha256).not.toBe(SEQ5.sha256);
    expect(r.cid.status).toBe("mismatch");
  });

  it("flags a CID/bytes mismatch even when sha256 matches", () => {
    const otherRawCid = "bafkreic5ywzvohvo6kbiuym2q57omcfruwgfrbekfip73h33jqjdolgdaq";
    const r = verifyContentBytes(original, { ...SEQ5, cid: otherRawCid }, fileSource);
    expect(r.state).toBe("hash-mismatch");
  });
});

describe("resolveGateways", () => {
  it("puts primary first, de-duplicates and strips trailing slashes", () => {
    const g = resolveGateways("https://ipfs.io/ipfs/", "http://127.0.0.1:8080/ipfs, https://ipfs.io/ipfs");
    expect(g[0]).toBe("https://ipfs.io/ipfs");
    expect(g[1]).toBe("http://127.0.0.1:8080/ipfs");
    expect(new Set(g).size).toBe(g.length);
  });
});

describe("fetchFromGateways / verifyAttestedContent", () => {
  it("falls back to the next gateway on HTTP errors", async () => {
    const fetchImpl = vi.fn<FetchLike>(async (url) =>
      url.startsWith("https://a") ? response("rate limited", 429) : response(original),
    );
    const r = await verifyAttestedContent(SEQ5, ["https://a/ipfs", "https://b/ipfs"], { fetchImpl });
    expect(r.state).toBe("match");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(r.attempts).toEqual([{ url: `https://a/ipfs/${SEQ5.cid}`, error: "HTTP 429" }]);
    if (r.state !== "unavailable") expect(r.source).toEqual({ kind: "gateway", url: `https://b/ipfs/${SEQ5.cid}` });
  });

  it("reports hash-mismatch when a gateway serves tampered bytes", async () => {
    const r = await verifyAttestedContent(SEQ5, ["https://evil/ipfs"], {
      fetchImpl: async () => response(tampered),
    });
    expect(r.state).toBe("hash-mismatch");
  });

  it("reports unavailable when every gateway fails or times out", async () => {
    const fetchImpl: FetchLike = (url, init) =>
      url.startsWith("https://slow")
        ? new Promise((_, reject) =>
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
          )
        : Promise.reject(new Error("ECONNREFUSED"));
    const r = await verifyAttestedContent(SEQ5, ["https://slow/ipfs", "https://down/ipfs"], {
      fetchImpl,
      timeoutMs: 20,
    });
    expect(r.state).toBe("unavailable");
    expect(r.attempts.map((a) => a.error)).toEqual(["timeout after 20 ms", "ECONNREFUSED"]);
  });

  it("skips gateways whose response exceeds maxBytes", async () => {
    const r = await fetchFromGateways(SEQ5.cid, ["https://big/ipfs"], {
      maxBytes: 10,
      fetchImpl: async () => response(original, 200, { "content-length": "61" }),
    });
    expect(r.ok).toBe(false);
    expect(r.attempts[0].error).toMatch(/exceeds 10 bytes/);
  });
});
