/**
 * Create an HCS topic for the vault and print env lines + HashScan URL.
 * Usage: yarn demo:topic
 */
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createVaultTopic } from "../lib/hedera";
import { getVaultEnv } from "../lib/env";

async function main() {
  const env = getVaultEnv();
  if (!env.accountId || !env.privateKey) {
    console.error("Set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY in .env (faucet: https://portal.hedera.com/faucet)");
    process.exit(1);
  }
  const result = await createVaultTopic("hcs-ipfs-document-vault");
  console.log("Topic created:");
  console.log(`  HCS_TOPIC_ID=${result.topicId}`);
  console.log(`  NEXT_PUBLIC_HCS_TOPIC_ID=${result.topicId}`);
  console.log(`  transactionId=${result.transactionId}`);
  console.log(`  HashScan: ${result.hashScanUrl}`);

  const rootEnv = resolve(process.cwd(), "../../.env");
  if (existsSync(rootEnv)) {
    let text = readFileSync(rootEnv, "utf8");
    if (/^HCS_TOPIC_ID=/m.test(text)) {
      text = text.replace(/^HCS_TOPIC_ID=.*$/m, `HCS_TOPIC_ID=${result.topicId}`);
    } else {
      text += `\nHCS_TOPIC_ID=${result.topicId}\n`;
    }
    if (/^NEXT_PUBLIC_HCS_TOPIC_ID=/m.test(text)) {
      text = text.replace(/^NEXT_PUBLIC_HCS_TOPIC_ID=.*$/m, `NEXT_PUBLIC_HCS_TOPIC_ID=${result.topicId}`);
    } else {
      text += `NEXT_PUBLIC_HCS_TOPIC_ID=${result.topicId}\n`;
    }
    writeFileSync(rootEnv, text);
    console.log(`Updated ${rootEnv}`);
  } else {
    console.log("No root .env found — copy the HCS_TOPIC_ID lines above into your .env");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
