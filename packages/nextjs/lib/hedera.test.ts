import { PrivateKey } from "@hashgraph/sdk";
import { describe, expect, it } from "vitest";
import { resolveSubmitKey } from "./hedera";
import type { VaultEnv } from "./env";

const operator = PrivateKey.generateECDSA();
const env = (hcsSubmitKey: string, privateKey = operator.toStringRaw()) =>
  ({ hcsSubmitKey, privateKey }) as VaultEnv;

describe("resolveSubmitKey (HCS_SUBMIT_KEY)", () => {
  it("unset → public topic (no submit key)", () => {
    expect(resolveSubmitKey(env(""))).toBeNull();
  });

  it("'operator' reuses HEDERA_PRIVATE_KEY", () => {
    const key = resolveSubmitKey(env("operator"));
    expect(key?.publicKey.toStringRaw()).toBe(operator.publicKey.toStringRaw());
  });

  it("'operator' without an operator key is an error", () => {
    expect(() => resolveSubmitKey(env("operator", ""))).toThrow(/HEDERA_PRIVATE_KEY/);
  });

  it("accepts a dedicated DER private key", () => {
    const dedicated = PrivateKey.generateED25519();
    const key = resolveSubmitKey(env(dedicated.toStringDer()));
    expect(key?.publicKey.toStringDer()).toBe(dedicated.publicKey.toStringDer());
  });

  it("rejects garbage without echoing it", () => {
    expect(() => resolveSubmitKey(env("not-a-key"))).toThrow(
      "HCS_SUBMIT_KEY is not a valid private key (or use HCS_SUBMIT_KEY=operator)",
    );
  });
});
