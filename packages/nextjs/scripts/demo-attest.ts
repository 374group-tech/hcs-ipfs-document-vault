/**
 * One-click demo: hash a sample doc → IPFS (or precomputed CID) → HCS attest.
 * Prints HashScan URL for the eligibility gate.
 *
 * Usage: yarn demo:attest
 * Env: HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, HCS_TOPIC_ID
 * Optional: DEMO_PRECOMPUTED_CID to skip IPFS; IPFS_API_URL for Kubo
 */
import { createHash } from "node:crypto";
import { addToIpfs } from "../lib/ipfs";
import { submitAttestation } from "../lib/hedera";
import { getVaultEnv } from "../lib/env";

async function main() {
  const env = getVaultEnv();
  if (!env.accountId || !env.privateKey) {
    console.error("Missing HEDERA_ACCOUNT_ID / HEDERA_PRIVATE_KEY — see .env.example and the faucet.");
    process.exit(1);
  }
  if (!env.topicId) {
    console.error("Missing HCS_TOPIC_ID — run yarn demo:topic first.");
    process.exit(1);
  }

  const sample = Buffer.from(
    `hcs-ipfs-document-vault demo\nnetwork=${env.network}\nts=${new Date().toISOString()}\n`,
    "utf8",
  );
  const sha256 = createHash("sha256").update(sample).digest("hex");
  const precomputed = process.env.DEMO_PRECOMPUTED_CID || "";

  console.log(`sha256=${sha256}`);
  console.log(`size=${sample.byteLength}`);

  let cid: string;
  let source: string;
  try {
    const added = await addToIpfs(sample, {
      filename: "vault-demo.txt",
      precomputedCid: precomputed || undefined,
    });
    cid = added.cid;
    source = added.source;
  } catch (e) {
    // Fallback dry-run CID so docs/CI can still exercise HCS without Kubo
    cid =
      precomputed ||
      "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    source = "precomputed-fallback";
    console.warn(`IPFS unavailable (${String(e)}). Using ${source} cid=${cid}`);
    console.warn("Without IPFS the vault has nowhere for real bytes — start Kubo for the happy path.");
  }

  console.log(`cid=${cid} source=${source}`);

  const result = await submitAttestation({
    cid,
    sha256,
    size: sample.byteLength,
    memo: "demo:attest",
  });

  console.log("\n=== Attestation OK ===");
  console.log(`topicId=${result.topicId}`);
  console.log(`sequenceNumber=${result.sequenceNumber}`);
  console.log(`transactionId=${result.transactionId}`);
  console.log(`HashScan topic message: ${result.hashScanTopicUrl}`);
  console.log(`HashScan transaction:   ${result.hashScanTxUrl}`);
  console.log(`message=${JSON.stringify(result.attestation)}`);
  if (result.pinFee) {
    console.log(`pinFee=${JSON.stringify(result.pinFee)}`);
  } else {
    console.log("pinFee=skipped (PIN_TOKEN_ID unset — free attest, network fee only)");
  }
  console.log("\nPaste the HashScan topic message URL into README Status when you have a funded testnet key.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
