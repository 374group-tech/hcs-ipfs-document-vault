import { describe, expect, it } from "vitest";
import {
  ATTESTATION_SCHEMA_VERSION,
  buildVaultAttestation,
  parseVaultAttestation,
  serializeVaultAttestation,
} from "../src/schema";
import { fromBaseUnits, hbarToTinybar, toBaseUnits } from "../src/money";
import {
  hashScanTopicMessageUrl,
  ipfsGatewayUrl,
  mirrorNodeBase,
  mirrorTopicMessagesUrl,
  mirrorTopicMessageUrl,
  formatConsensusTimestamp,
} from "../src/hashscan";
import {
  decodeHcsMessageBase64,
  findCidMatches,
  matchFromMirrorMessage,
} from "../src/verify";

const sampleCid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const sampleSha = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
const prevCid = "bafkreif7ckqfqbizpthadxlizpgwlgujq6lv3uj26ef2bshy4n2kyd2yny";

describe("vault attestation schema", () => {
  it("round-trips a valid message (writes schema v1)", () => {
    const att = buildVaultAttestation({
      cid: sampleCid,
      sha256: sampleSha,
      size: 5,
      payer: "0.0.1234",
      memo: "demo",
      ts: 1_700_000_000_000,
    });
    expect(att.schemaVersion).toBe(ATTESTATION_SCHEMA_VERSION);
    const json = serializeVaultAttestation(att);
    expect(JSON.parse(json).schemaVersion).toBe(1);
    const parsed = parseVaultAttestation(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.cid).toBe(sampleCid);
      expect(parsed.value.payer).toBe("0.0.1234");
      expect(parsed.value.size).toBe(5);
      expect(parsed.value.schemaVersion).toBe(1);
    }
  });

  it("accepts legacy messages without schemaVersion", () => {
    const legacy = {
      cid: sampleCid,
      sha256: sampleSha,
      size: 5,
      payer: "0.0.1234",
      memo: "legacy",
      ts: 1_700_000_000_000,
    };
    const parsed = parseVaultAttestation(legacy);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.schemaVersion).toBeUndefined();
      expect(parsed.value.cid).toBe(sampleCid);
    }
  });

  it("accepts schema v1 with optional mime and prevCid", () => {
    const parsed = parseVaultAttestation({
      schemaVersion: 1,
      cid: sampleCid,
      sha256: sampleSha,
      size: 10,
      payer: "0.0.99",
      memo: "rev",
      ts: 1_700_000_000_001,
      mime: "application/pdf",
      prevCid,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.mime).toBe("application/pdf");
      expect(parsed.value.prevCid).toBe(prevCid);
      expect(parsed.value.schemaVersion).toBe(1);
    }
    const json = serializeVaultAttestation(
      buildVaultAttestation({
        cid: sampleCid,
        sha256: sampleSha,
        size: 10,
        payer: "0.0.99",
        memo: "rev",
        mime: "application/pdf",
        prevCid,
        ts: 1_700_000_000_001,
      }),
    );
    const again = JSON.parse(json);
    expect(again.mime).toBe("application/pdf");
    expect(again.prevCid).toBe(prevCid);
    expect(again.schemaVersion).toBe(1);
  });

  it("rejects unsupported schemaVersion", () => {
    const r = parseVaultAttestation({
      schemaVersion: 99,
      cid: sampleCid,
      sha256: sampleSha,
      size: 1,
      payer: "0.0.1",
      memo: "",
      ts: 1,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects bad sha256", () => {
    const r = parseVaultAttestation({
      cid: sampleCid,
      sha256: "deadbeef",
      size: 1,
      payer: "0.0.1",
      memo: "",
      ts: 1,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects bad payer", () => {
    const r = parseVaultAttestation({
      cid: sampleCid,
      sha256: sampleSha,
      size: 1,
      payer: "alice",
      memo: "",
      ts: 1,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects invalid JSON string", () => {
    const r = parseVaultAttestation("{not-json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not valid JSON/);
  });

  it("rejects non-object / missing cid / negative size / bad prevCid", () => {
    expect(parseVaultAttestation(null).ok).toBe(false);
    expect(parseVaultAttestation([]).ok).toBe(false);
    expect(
      parseVaultAttestation({
        sha256: sampleSha,
        size: 1,
        payer: "0.0.1",
        memo: "",
        ts: 1,
      }).ok,
    ).toBe(false);
    expect(
      parseVaultAttestation({
        cid: sampleCid,
        sha256: sampleSha,
        size: -1,
        payer: "0.0.1",
        memo: "",
        ts: 1,
      }).ok,
    ).toBe(false);
    expect(
      parseVaultAttestation({
        cid: sampleCid,
        sha256: sampleSha,
        size: 1.5,
        payer: "0.0.1",
        memo: "",
        ts: 1,
      }).ok,
    ).toBe(false);
    expect(
      parseVaultAttestation({
        schemaVersion: 1,
        cid: sampleCid,
        sha256: sampleSha,
        size: 1,
        payer: "0.0.1",
        memo: "",
        ts: 1,
        prevCid: "!!not-a-cid!!",
      }).ok,
    ).toBe(false);
  });

  it("normalizes sha256 case and omits empty mime; accepts schemaVersion string '1'", () => {
    const parsed = parseVaultAttestation({
      schemaVersion: "1",
      cid: sampleCid,
      sha256: sampleSha.toUpperCase(),
      size: 0,
      payer: "0.0.1",
      memo: "",
      ts: 1,
      mime: "",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.sha256).toBe(sampleSha.toLowerCase());
      expect(parsed.value.schemaVersion).toBe(1);
      expect(parsed.value.mime).toBeUndefined();
    }
  });

  it("serializeVaultAttestation throws on invalid input", () => {
    expect(() =>
      serializeVaultAttestation({
        cid: "bad",
        sha256: sampleSha,
        size: 1,
        payer: "0.0.1",
        memo: "",
        ts: 1,
      }),
    ).toThrow();
  });
});


describe("money bigint", () => {
  it("converts HBAR without floats", () => {
    expect(hbarToTinybar("1")).toBe(100_000_000n);
    expect(hbarToTinybar("0.00000001")).toBe(1n);
    expect(toBaseUnits("12.34", 2)).toBe(1234n);
    expect(fromBaseUnits(1234n, 2)).toBe("12.34");
  });
});

describe("hashscan helpers", () => {
  it("builds topic message and ipfs urls", () => {
    expect(hashScanTopicMessageUrl("0.0.99", 7, "testnet")).toBe(
      "https://hashscan.io/testnet/topic/0.0.99/7",
    );
    expect(ipfsGatewayUrl(sampleCid)).toContain(sampleCid);
  });
});

describe("mirror node helpers", () => {
  it("builds list and single-message URLs", () => {
    expect(mirrorNodeBase("testnet")).toBe("https://testnet.mirrornode.hedera.com");
    expect(mirrorTopicMessagesUrl("0.0.99", { limit: 25, order: "asc" })).toBe(
      "https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.99/messages?limit=25&order=asc",
    );
    expect(mirrorTopicMessageUrl("0.0.99", 3, "testnet")).toBe(
      "https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.99/messages/3",
    );
    expect(
      mirrorTopicMessageUrl("0.0.99", 3, "https://testnet.mirrornode.hedera.com/"),
    ).toContain("/topics/0.0.99/messages/3");
  });

  it("formats consensus timestamps", () => {
    expect(formatConsensusTimestamp("1700000000.000000000")).toBe("2023-11-14T22:13:20.000Z");
    expect(formatConsensusTimestamp("not-a-ts")).toBe("not-a-ts");
  });
});

describe("verify proof helpers (mock mirror)", () => {
  const legacyBody = JSON.stringify({
    cid: sampleCid,
    sha256: sampleSha,
    size: 5,
    payer: "0.0.1234",
    memo: "legacy",
    ts: 1_700_000_000_000,
  });
  const v1Body = JSON.stringify({
    schemaVersion: 1,
    cid: sampleCid,
    sha256: sampleSha,
    size: 5,
    payer: "0.0.1234",
    memo: "v1",
    ts: 1_700_000_000_001,
    mime: "text/plain",
    prevCid,
  });
  const otherBody = JSON.stringify({
    cid: prevCid,
    sha256: sampleSha,
    size: 1,
    payer: "0.0.1",
    memo: "",
    ts: 1,
  });

  it("decodes base64 and matches legacy + v1 by cid", () => {
    const messages = [
      {
        sequence_number: 1,
        consensus_timestamp: "1700000000.000000000",
        topic_id: "0.0.99",
        message: Buffer.from(otherBody, "utf8").toString("base64"),
      },
      {
        sequence_number: 2,
        consensus_timestamp: "1700000001.000000000",
        topic_id: "0.0.99",
        message: Buffer.from(legacyBody, "utf8").toString("base64"),
      },
      {
        sequence_number: 3,
        consensus_timestamp: "1700000002.000000000",
        topic_id: "0.0.99",
        message: Buffer.from(v1Body, "utf8").toString("base64"),
      },
    ];
    expect(decodeHcsMessageBase64(messages[1].message)).toContain(sampleCid);
    const matches = findCidMatches(messages, sampleCid, { topicId: "0.0.99", network: "testnet" });
    expect(matches).toHaveLength(2);
    expect(matches[0].sequenceNumber).toBe(2);
    expect(matches[0].attestation.schemaVersion).toBeUndefined();
    expect(matches[1].sequenceNumber).toBe(3);
    expect(matches[1].attestation.schemaVersion).toBe(1);
    expect(matches[1].attestation.prevCid).toBe(prevCid);
    expect(matches[1].hashScanUrl).toBe("https://hashscan.io/testnet/topic/0.0.99/3");
  });

  it("returns null for non-attestation payloads", () => {
    const junk = {
      sequence_number: 9,
      consensus_timestamp: "1.0",
      message: Buffer.from("not-json", "utf8").toString("base64"),
    };
    expect(matchFromMirrorMessage(junk, { topicId: "0.0.1" })).toBeNull();
  });

  it("returns empty matches when cid absent; ignores garbage among valid", () => {
    const messages = [
      {
        sequence_number: 1,
        consensus_timestamp: "1.0",
        message: Buffer.from("{}", "utf8").toString("base64"),
      },
      {
        sequence_number: 2,
        consensus_timestamp: "2.0",
        topic_id: "0.0.99",
        message: Buffer.from(legacyBody, "utf8").toString("base64"),
      },
    ];
    expect(findCidMatches(messages, "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", { topicId: "0.0.99" })).toHaveLength(1);
    expect(findCidMatches(messages, "bafybeiunknowncidxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", { topicId: "0.0.99" })).toHaveLength(0);
  });
});
