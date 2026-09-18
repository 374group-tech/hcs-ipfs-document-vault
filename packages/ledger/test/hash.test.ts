import { describe, expect, it } from "vitest";
import { isSha256Hex, sha256Hex, sha256HexOfString } from "../src/hash";

describe("sha256Hex", () => {
  it("hashes empty bytes to known digest", () => {
    expect(sha256Hex(new Uint8Array())).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("hashes utf8 string via helper", () => {
    expect(sha256HexOfString("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("validates hex digests", () => {
    expect(isSha256Hex("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824")).toBe(
      true,
    );
    expect(isSha256Hex("zz")).toBe(false);
    expect(isSha256Hex("")).toBe(false);
  });
});
