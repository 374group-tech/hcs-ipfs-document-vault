/**
 * CLI: verify a CID against HCS topic messages via Mirror Node.
 *
 * Usage:
 *   yarn verify:proof <CID> [--topic 0.0.x] [--sequence N]
 *   yarn workspace @vault/nextjs verify:proof <CID>
 *
 * Env: HCS_TOPIC_ID (required unless --topic), HEDERA_MIRROR_NODE_URL, HEDERA_NETWORK
 * Exit: 0 on match, 1 on no match / error
 */
import {
  findCidMatches,
  matchFromMirrorMessage,
  mirrorTopicMessagesUrl,
  mirrorTopicMessageUrl,
} from "@vault/ledger";
import {
  fetchTopicMessageBySequence,
  fetchTopicMessages,
} from "../lib/hedera";
import { getVaultEnv } from "../lib/env";

function usage(): never {
  console.error(`Usage: yarn verify:proof <CID> [--topic 0.0.x] [--sequence N]

Fetches Mirror Node HCS messages for the topic, finds an attestation matching CID
(legacy or schema v1). Prints match, sequence, consensus timestamp, HashScan URL, sha256.

Env: HCS_TOPIC_ID (or --topic), HEDERA_MIRROR_NODE_URL, HEDERA_NETWORK
Exit codes: 0 = match, 1 = no match / error`);
  process.exit(1);
}

function parseArgs(argv: string[]): {
  cid: string;
  topicId?: string;
  sequence?: number;
} {
  const args = argv.slice(2);
  let cid = "";
  let topicId: string | undefined;
  let sequence: number | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") continue; // yarn may forward the separator
    if (a === "--help" || a === "-h") usage();
    if (a === "--topic" || a === "-t") {
      topicId = args[++i];
      continue;
    }
    if (a === "--sequence" || a === "-s") {
      const n = Number(args[++i]);
      if (!Number.isFinite(n) || n < 1) {
        console.error("error: --sequence must be a positive integer");
        process.exit(1);
      }
      sequence = n;
      continue;
    }
    if (a.startsWith("-")) {
      console.error(`error: unknown flag ${a}`);
      usage();
    }
    if (!cid) cid = a;
    else {
      console.error("error: unexpected extra argument:", a);
      usage();
    }
  }
  if (!cid) usage();
  return { cid, topicId, sequence };
}

async function main() {
  const { cid, topicId: topicArg, sequence } = parseArgs(process.argv);
  const env = getVaultEnv();
  const topicId = (topicArg || env.topicId || "").trim();
  if (!topicId) {
    console.error("error: HCS_TOPIC_ID (or --topic) is required");
    process.exit(1);
  }

  console.log(`cid=${cid}`);
  console.log(`topicId=${topicId}`);
  console.log(`mirror=${env.mirrorNodeUrl}`);
  if (sequence) console.log(`sequence=${sequence}`);

  try {
    if (sequence) {
      const url = mirrorTopicMessageUrl(topicId, sequence, env.mirrorNodeUrl);
      console.log(`fetch=${url}`);
      const msg = await fetchTopicMessageBySequence(topicId, sequence);
      if (!msg) {
        console.log("match=no");
        console.error(`No message at sequence ${sequence}`);
        process.exit(1);
      }
      const match = matchFromMirrorMessage(msg, { topicId, network: env.network });
      if (!match) {
        console.log("match=no");
        console.error("Message at sequence is not a vault attestation");
        process.exit(1);
      }
      if (match.attestation.cid !== cid) {
        console.log("match=no");
        console.log(`foundCid=${match.attestation.cid}`);
        console.log(`sequence=${match.sequenceNumber}`);
        console.log(`consensusTimestamp=${match.consensusTimestamp}`);
        console.log(`hashScanUrl=${match.hashScanUrl}`);
        console.error(`CID mismatch: expected ${cid}, found ${match.attestation.cid}`);
        process.exit(1);
      }
      printMatch(match);
      process.exit(0);
    }

    const listUrl = mirrorTopicMessagesUrl(topicId, {
      networkOrUrl: env.mirrorNodeUrl,
      limit: 100,
      order: "desc",
    });
    console.log(`fetch=${listUrl}`);
    const messages = await fetchTopicMessages(topicId, { limit: 100, order: "desc" });
    const matches = findCidMatches(messages, cid, { topicId, network: env.network });
    console.log(`scanned=${messages.length}`);
    if (matches.length === 0) {
      console.log("match=no");
      console.error(`No attestation matching cid=${cid} in last ${messages.length} messages`);
      process.exit(1);
    }
    // Prefer newest (desc order → first)
    printMatch(matches[0]);
    if (matches.length > 1) {
      console.log(`additionalMatches=${matches.length - 1}`);
    }
    process.exit(0);
  } catch (e) {
    console.log("match=no");
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

function printMatch(match: {
  attestation: { cid: string; sha256: string; schemaVersion?: number; prevCid?: string; mime?: string };
  sequenceNumber: number;
  consensusTimestamp: string;
  consensusTimestampIso: string;
  hashScanUrl: string;
}) {
  console.log("match=yes");
  console.log(`sequence=${match.sequenceNumber}`);
  console.log(`consensusTimestamp=${match.consensusTimestamp}`);
  console.log(`consensusTimestampIso=${match.consensusTimestampIso}`);
  console.log(`hashScanUrl=${match.hashScanUrl}`);
  console.log(`sha256=${match.attestation.sha256}`);
  if (match.attestation.schemaVersion !== undefined) {
    console.log(`schemaVersion=${match.attestation.schemaVersion}`);
  } else {
    console.log("schemaVersion=legacy");
  }
  if (match.attestation.mime) console.log(`mime=${match.attestation.mime}`);
  if (match.attestation.prevCid) console.log(`prevCid=${match.attestation.prevCid}`);
}

main();
