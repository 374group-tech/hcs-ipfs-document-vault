/**
 * verifyVaultCid end-to-end with mocked Mirror Node + IPFS gateway responses.
 * Run: yarn workspace @vault/nextjs test
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXIT_CODES, verifyVaultCid } from "./vault-verify";
import type { VaultEnv } from "./env";

const TOPIC = "0.0.10600873";
const MIRROR = "https://mirror.test";
const CID = "bafkreihbeveqd5e6z7sry2zjyxqfzzjcoc6efxnj4isnb47tyt5xnedlru";
const examples = resolve(__dirname, "../../../docs/examples");
const original = readFileSync(resolve(examples, "agreement-seq5.txt"));
const tampered = readFileSync(resolve(examples, "agreement-seq5-tampered.txt"));

const env = {
  network: "testnet",
  mirrorNodeUrl: MIRROR,
  ipfsGatewayUrl: "https://gw-a.test/ipfs",
  ipfsGatewayFallbacks: "",
  ipfsGatewayTimeoutMs: 1000,
} as VaultEnv;

function attestationMessage(seq: number, payer = "0.0.10600860", mirrorPayer = "0.0.10600860") {
  const body = {
    schemaVersion: 1,
    cid: CID,
    sha256: "e1254901f49ecfe51c6b29c5e05ce52270bc42dda9e224d0f3f3c4fb76906b8d",
    size: 61,
    payer,
    memo: "vault-attest",
    ts: 1790452499637,
  };
  return {
    consensus_timestamp: `1790452500.00000000${seq}`,
    topic_id: TOPIC,
    sequence_number: seq,
    payer_account_id: mirrorPayer,
    message: Buffer.from(JSON.stringify(body)).toString("base64"),
  };
}

type Route = (url: string) => Response | undefined;

function stubFetch(...routes: Route[]) {
  const spy = vi.fn(async (input: string | URL) => {
    const url = String(input);
    for (const r of routes) {
      const res = r(url);
      if (res) return res;
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

const toArrayBuffer = (b: Buffer) =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200 });
const bySequence =
  (msg: ReturnType<typeof attestationMessage>): Route =>
  (url) =>
    url === `${MIRROR}/api/v1/topics/${TOPIC}/messages/${msg.sequence_number}` ? json(msg) : undefined;
const gateway =
  (prefix: string, body: Buffer | null, status = 200): Route =>
  (url) =>
    url.startsWith(prefix) ? new Response(body ? toArrayBuffer(body) : null, { status }) : undefined;

describe("verifyVaultCid", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("match: HCS anchor + gateway bytes + raw CID recomputed", async () => {
    stubFetch(bySequence(attestationMessage(5)), gateway("https://gw-a.test", original));
    const r = await verifyVaultCid({ cid: CID, topicId: TOPIC, sequence: 5, content: { mode: "gateway" }, env });
    expect(r.verdict).toBe("match");
    expect(EXIT_CODES[r.verdict]).toBe(0);
    expect(r.primary?.content?.state).toBe("match");
    expect(r.primary?.payerCheck).toBe("match");
  });

  it("hash-mismatch (exit 2) when the gateway serves tampered bytes", async () => {
    stubFetch(bySequence(attestationMessage(5)), gateway("https://gw-a.test", tampered));
    const r = await verifyVaultCid({ cid: CID, topicId: TOPIC, sequence: 5, content: { mode: "gateway" }, env });
    expect(r.verdict).toBe("hash-mismatch");
    expect(EXIT_CODES[r.verdict]).toBe(2);
  });

  it("hash-mismatch for the bundled tampered file passed as bytes", async () => {
    stubFetch(bySequence(attestationMessage(5)));
    const r = await verifyVaultCid({
      cid: CID,
      topicId: TOPIC,
      sequence: 5,
      content: { mode: "bytes", bytes: tampered, source: { kind: "file", path: "tampered.txt" } },
      env,
    });
    expect(r.verdict).toBe("hash-mismatch");
  });

  it("content-unavailable (exit 3) when every gateway fails, falling back in order", async () => {
    const spy = stubFetch(
      bySequence(attestationMessage(5)),
      gateway("https://gw-a.test", null, 429),
      gateway("https://gw-b.test", null, 504),
      gateway("https://", null, 503),
    );
    const r = await verifyVaultCid({
      cid: CID,
      topicId: TOPIC,
      sequence: 5,
      content: { mode: "gateway" },
      env: { ...env, ipfsGatewayFallbacks: "https://gw-b.test/ipfs" },
    });
    expect(r.verdict).toBe("content-unavailable");
    expect(EXIT_CODES[r.verdict]).toBe(3);
    const gatewayCalls = spy.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/ipfs/"));
    expect(gatewayCalls[0]).toContain("gw-a.test");
    expect(gatewayCalls[1]).toContain("gw-b.test");
  });

  it("hcs-only (exit 0) with content skipped", async () => {
    const spy = stubFetch(bySequence(attestationMessage(5)));
    const r = await verifyVaultCid({ cid: CID, topicId: TOPIC, sequence: 5, content: { mode: "skip" }, env });
    expect(r.verdict).toBe("hcs-only");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("payer-mismatch (exit 4) when a third party posts a spoofed attestation", async () => {
    stubFetch(bySequence(attestationMessage(7, "0.0.10600860", "0.0.666")));
    const r = await verifyVaultCid({ cid: CID, topicId: TOPIC, sequence: 7, content: { mode: "skip" }, env });
    expect(r.verdict).toBe("payer-mismatch");
    expect(EXIT_CODES[r.verdict]).toBe(4);
  });

  it("scan mode pages through links.next and prefers the newest honest match", async () => {
    const first = `${MIRROR}/api/v1/topics/${TOPIC}/messages?limit=100&order=desc`;
    const next = `/api/v1/topics/${TOPIC}/messages?limit=100&order=desc&sequencenumber=lt:9`;
    stubFetch((url) => {
      if (url === first)
        return json({ messages: [attestationMessage(9, "0.0.10600860", "0.0.666")], links: { next } });
      if (url === `${MIRROR}${next}`)
        return json({ messages: [attestationMessage(5)], links: { next: null } });
      return undefined;
    });
    const r = await verifyVaultCid({ cid: CID, topicId: TOPIC, content: { mode: "skip" }, env });
    expect(r.pages).toBe(2);
    expect(r.matches.map((m) => m.sequenceNumber)).toEqual([9, 5]);
    expect(r.primary?.sequenceNumber).toBe(5);
    expect(r.verdict).toBe("hcs-only");
  });

  it("not-anchored (exit 1) when the sequence attests a different CID", async () => {
    stubFetch(bySequence(attestationMessage(5)));
    const r = await verifyVaultCid({
      cid: "bafkreif7ckqfqbizpthadxlizpgwlgujq6lv3uj26ef2bshy4n2kyd2yny",
      topicId: TOPIC,
      sequence: 5,
      content: { mode: "gateway" },
      env,
    });
    expect(r.verdict).toBe("not-anchored");
    expect(r.mismatch?.foundCid).toBe(CID);
  });
});
