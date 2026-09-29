/**
 * CLI: trustless verify of a CID against its HCS attestation (Mirror Node) and the IPFS bytes.
 *
 * Usage:
 *   yarn verify:proof <CID> [--topic 0.0.x] [--sequence N] [--file PATH | --skip-content] [--max-pages N]
 *
 * Env: HCS_TOPIC_ID (or --topic), HEDERA_MIRROR_NODE_URL, HEDERA_NETWORK,
 *      IPFS_GATEWAY_URL, IPFS_GATEWAY_FALLBACKS, IPFS_GATEWAY_TIMEOUT_MS
 * Exit codes: see EXIT_CODES in lib/vault-verify.ts and README "Verify states".
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getVaultEnv } from "../lib/env";
import {
  EXIT_CODES,
  verifyVaultCid,
  type ContentInput,
  type VerifiedMatch,
} from "../lib/vault-verify";

const USAGE = `Usage: yarn verify:proof <CID> [--topic 0.0.x] [--sequence N] [--file PATH | --skip-content] [--max-pages N]

1. Finds the CID's HCS attestation via Mirror Node (--sequence, or pages through all messages).
2. Compares the attestation's self-declared payer with Mirror payer_account_id.
3. Downloads the bytes from IPFS gateways (or reads --file), recomputes sha256 (and raw CIDs)
   and compares them to the sha256 anchored on HCS.

Exit codes:
  0  match (or HCS-only match with --skip-content)
  1  not anchored on the topic / usage or network error
  2  hash-mismatch: bytes do not match the anchored sha256 (tampered)
  3  content-unavailable: anchored on HCS, but no gateway returned the bytes
  4  payer-mismatch: attestation payer differs from the account that paid for the message`;

function fail(msg: string): never {
  console.error(`error: ${msg}\n\n${USAGE}`);
  process.exit(1);
}

type Args = {
  cid: string;
  topicId?: string;
  sequence?: number;
  file?: string;
  skipContent: boolean;
  maxPages?: number;
};

function positiveInt(flag: string, v: string | undefined): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) fail(`${flag} must be a positive integer`);
  return n;
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  const out: Args = { cid: "", skipContent: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") continue; // yarn may forward the separator
    if (a === "--help" || a === "-h") {
      console.log(USAGE);
      process.exit(0);
    }
    if (a === "--topic" || a === "-t") out.topicId = args[++i];
    else if (a === "--sequence" || a === "-s") out.sequence = positiveInt(a, args[++i]);
    else if (a === "--max-pages") out.maxPages = positiveInt(a, args[++i]);
    else if (a === "--file" || a === "-f") out.file = args[++i];
    else if (a === "--skip-content") out.skipContent = true;
    else if (a.startsWith("-")) fail(`unknown flag ${a}`);
    else if (!out.cid) out.cid = a;
    else fail(`unexpected extra argument: ${a}`);
  }
  if (!out.cid) fail("CID is required");
  if (out.file && out.skipContent) fail("--file and --skip-content are mutually exclusive");
  return out;
}

function contentInput(args: Args): ContentInput {
  if (args.skipContent) return { mode: "skip" };
  if (!args.file) return { mode: "gateway" };
  // The script runs inside packages/nextjs: resolve relative paths from the repo root
  // (yarn sets PROJECT_CWD; npm sets INIT_CWD to the caller's directory).
  const base = process.env.PROJECT_CWD || process.env.INIT_CWD || process.cwd();
  const path = resolve(base, args.file);
  try {
    return { mode: "bytes", bytes: readFileSync(path), source: { kind: "file", path } };
  } catch (e) {
    fail(`cannot read --file ${path}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function printMatch(m: VerifiedMatch) {
  const a = m.attestation;
  console.log(`sequence=${m.sequenceNumber}`);
  console.log(`consensusTimestamp=${m.consensusTimestamp}`);
  console.log(`consensusTimestampIso=${m.consensusTimestampIso}`);
  console.log(`hashScanUrl=${m.hashScanUrl}`);
  console.log(`schemaVersion=${a.schemaVersion ?? "legacy"}`);
  if (a.mime) console.log(`mime=${a.mime}`);
  if (a.prevCid) console.log(`prevCid=${a.prevCid}`);
  console.log(`payer=${a.payer}`);
  console.log(`mirrorPayer=${m.payerAccountId ?? "unknown"}`);
  console.log(`payerCheck=${m.payerCheck}`);
  console.log(`sha256=${a.sha256}`);
  const c = m.content;
  if (!c) {
    console.log("content=skipped");
    return;
  }
  for (const at of c.attempts) console.log(`gatewayFailed=${at.url} (${at.error})`);
  console.log(`content=${c.state}`);
  if (c.state === "unavailable") return;
  console.log(`contentSource=${c.source.kind === "file" ? c.source.path : c.source.url}`);
  console.log(`computedSha256=${c.computedSha256}`);
  console.log(`size=${c.actualSize} (anchored ${c.expectedSize})`);
  if (c.cid.status === "not-recomputable") {
    console.log(`cidCheck=not-recomputable (${c.cid.reason})`);
  } else {
    console.log(`cidCheck=${c.cid.status}`);
    console.log(`computedCid=${c.cid.computedCid}`);
  }
}

const VERDICT_MESSAGES: Record<string, string> = {
  "not-anchored": "No vault attestation for this CID on the topic.",
  "hash-mismatch": "TAMPERED: the bytes do not match the sha256 anchored on HCS.",
  "content-unavailable":
    "Anchored on HCS, but no gateway returned the bytes (try IPFS_GATEWAY_FALLBACKS or --file).",
  "payer-mismatch":
    "The attestation's payer field does not match the account that paid for the HCS message.",
};

async function main() {
  const args = parseArgs(process.argv);
  const env = getVaultEnv();
  const topicId = (args.topicId || env.topicId || "").trim();
  if (!topicId) fail("HCS_TOPIC_ID (or --topic) is required");

  console.log(`cid=${args.cid}`);
  console.log(`topicId=${topicId}`);
  console.log(`mirror=${env.mirrorNodeUrl}`);

  const r = await verifyVaultCid({
    cid: args.cid,
    topicId,
    sequence: args.sequence,
    content: contentInput(args),
    maxPages: args.maxPages,
    env,
  });

  console.log(`mode=${r.mode}`);
  console.log(`scanned=${r.scannedCount} pages=${r.pages}${r.truncated ? " (truncated)" : ""}`);
  if (r.mismatch) {
    console.log(`foundCid=${r.mismatch.foundCid}`);
    console.log(`hashScanUrl=${r.mismatch.hashScanUrl}`);
    console.error(`CID mismatch at sequence ${r.mismatch.sequenceNumber}`);
  }
  console.log(`match=${r.primary ? "yes" : "no"}`);
  if (r.primary) printMatch(r.primary);
  if (r.matches.length > 1) console.log(`additionalMatches=${r.matches.length - 1}`);
  console.log(`verdict=${r.verdict}`);
  if (VERDICT_MESSAGES[r.verdict]) console.error(VERDICT_MESSAGES[r.verdict]);
  process.exit(EXIT_CODES[r.verdict]);
}

main().catch((e) => {
  console.log("verdict=error");
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
