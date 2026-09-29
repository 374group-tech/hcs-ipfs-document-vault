import { describe, expect, it, vi } from "vitest";
import {
  checkPayer,
  collectMirrorPages,
  matchFromMirrorMessage,
  type MirrorMessagesPage,
} from "../src/verify";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");
const attestation = {
  cid: "bafkreihbeveqd5e6z7sry2zjyxqfzzjcoc6efxnj4isnb47tyt5xnedlru",
  sha256: "e1254901f49ecfe51c6b29c5e05ce52270bc42dda9e224d0f3f3c4fb76906b8d",
  size: 61,
  payer: "0.0.10600860",
  memo: "vault-attest",
  ts: 1790452499637,
};
const msg = (seq: number, payer?: string) => ({
  consensus_timestamp: `17904525${seq}.000000001`,
  message: b64(attestation),
  sequence_number: seq,
  payer_account_id: payer,
});

describe("payer check", () => {
  it("classifies match / mismatch / unknown", () => {
    expect(checkPayer("0.0.1", "0.0.1")).toBe("match");
    expect(checkPayer("0.0.1", "0.0.2")).toBe("mismatch");
    expect(checkPayer("0.0.1", undefined)).toBe("unknown");
  });

  it("flags a message whose self-declared payer differs from Mirror payer_account_id", () => {
    const spoofed = matchFromMirrorMessage(msg(9, "0.0.666"), { topicId: "0.0.10600873" });
    expect(spoofed?.payerCheck).toBe("mismatch");
    const honest = matchFromMirrorMessage(msg(5, "0.0.10600860"), { topicId: "0.0.10600873" });
    expect(honest?.payerCheck).toBe("match");
  });
});

describe("collectMirrorPages", () => {
  const base = "https://testnet.mirrornode.hedera.com";
  const first = `${base}/api/v1/topics/0.0.10600873/messages?limit=2&order=desc`;

  it("follows relative links.next until null", async () => {
    const pages: Record<string, MirrorMessagesPage> = {
      [first]: {
        messages: [msg(5), msg(4)],
        links: { next: "/api/v1/topics/0.0.10600873/messages?limit=2&order=desc&sequencenumber=lt:4" },
      },
      [`${base}/api/v1/topics/0.0.10600873/messages?limit=2&order=desc&sequencenumber=lt:4`]: {
        messages: [msg(3)],
        links: { next: null },
      },
    };
    const fetchPage = vi.fn(async (url: string) => pages[url]);
    const r = await collectMirrorPages(first, fetchPage);
    expect(r.messages.map((m) => m.sequence_number)).toEqual([5, 4, 3]);
    expect(r).toMatchObject({ pages: 2, truncated: false });
  });

  it("stops at maxPages and reports truncation", async () => {
    const fetchPage = async () => ({ messages: [msg(1)], links: { next: "/api/v1/next" } });
    const r = await collectMirrorPages(first, fetchPage, { maxPages: 3 });
    expect(r).toMatchObject({ pages: 3, truncated: true });
    expect(r.messages).toHaveLength(3);
  });
});
