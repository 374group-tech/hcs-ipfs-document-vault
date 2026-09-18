/**
 * Money helpers — always bigint base units, never floats.
 */

/** Parse a decimal string of whole tokens into base units given decimals. */
export function toBaseUnits(amount: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    throw new Error("amount must be a non-negative decimal string");
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("decimals out of range");
  }
  const [whole, frac = ""] = amount.split(".");
  if (frac.length > decimals) {
    throw new Error(`too many fractional digits (max ${decimals})`);
  }
  const padded = frac.padEnd(decimals, "0");
  const combined = `${whole}${padded}`.replace(/^0+(?=\d)/, "");
  return BigInt(combined === "" ? "0" : combined);
}

/** Format base units as a decimal string. */
export function fromBaseUnits(amount: bigint, decimals: number): string {
  if (amount < 0n) throw new Error("amount must be non-negative");
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("decimals out of range");
  }
  const neg = "";
  const s = amount.toString().padStart(decimals + 1, "0");
  if (decimals === 0) return neg + s;
  const whole = s.slice(0, -decimals) || "0";
  const frac = s.slice(-decimals).replace(/0+$/, "");
  return frac ? `${neg}${whole}.${frac}` : `${neg}${whole}`;
}

/** Tinybars (1 HBAR = 100_000_000 tinybar). */
export const TINYBAR_PER_HBAR = 100_000_000n;

export function hbarToTinybar(hbar: string): bigint {
  return toBaseUnits(hbar, 8);
}

export function tinybarToHbar(tinybar: bigint): string {
  return fromBaseUnits(tinybar, 8);
}
