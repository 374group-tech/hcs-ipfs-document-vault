import { describe, expect, it } from "vitest";
import {
  buildVaultAttestation,
  parseVaultAttestation,
  serializeVaultAttestation,
} from "../src/schema";
import { fromBaseUnits, hbarToTinybar, toBaseUnits } from "../src/money";
import { hashScanTopicMessageUrl, ipfsGatewayUrl } from "../src/hashscan";

const sampleCid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

describe("vault attestation schema", () => {
  it("round-trips a valid message", () => {
    const att = buildVaultAttestation({
      cid: sampleCid,
      sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      size: 5,
      payer: "0.0.1234",
      memo: "demo",
      ts: 1_700_000_000_000,
    });
    const json = serializeVaultAttestation(att);
    const parsed = parseVaultAttestation(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.cid).toBe(sampleCid);
      expect(parsed.value.payer).toBe("0.0.1234");
      expect(parsed.value.size).toBe(5);
    }
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
      sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      size: 1,
      payer: "alice",
      memo: "",
      ts: 1,
    });
    expect(r.ok).toBe(false);
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
