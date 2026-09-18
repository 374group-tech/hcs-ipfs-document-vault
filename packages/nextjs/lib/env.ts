import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

// Prefer monorepo root .env when running from packages/nextjs
loadDotenv({ path: resolve(process.cwd(), "../../.env") });
loadDotenv({ path: resolve(process.cwd(), ".env.local") });
loadDotenv();

export type VaultEnv = {
  network: string;
  accountId: string;
  privateKey: string;
  topicId: string;
  mirrorNodeUrl: string;
  ipfsApiUrl: string;
  ipfsGatewayUrl: string;
  pinTokenId: string;
  pinFeeAmount: string;
  pinTreasuryAccountId: string;
  pinFeeContractAddress: string;
  hashScanBase: string;
};

export function getVaultEnv(): VaultEnv {
  const network = process.env.HEDERA_NETWORK || process.env.NEXT_PUBLIC_HEDERA_NETWORK || "testnet";
  return {
    network,
    accountId: process.env.HEDERA_ACCOUNT_ID || "",
    privateKey: process.env.HEDERA_PRIVATE_KEY || "",
    topicId: process.env.HCS_TOPIC_ID || process.env.NEXT_PUBLIC_HCS_TOPIC_ID || "",
    mirrorNodeUrl:
      process.env.HEDERA_MIRROR_NODE_URL ||
      (network === "mainnet"
        ? "https://mainnet.mirrornode.hedera.com"
        : "https://testnet.mirrornode.hedera.com"),
    ipfsApiUrl: process.env.IPFS_API_URL || "http://127.0.0.1:5001",
    ipfsGatewayUrl:
      process.env.IPFS_GATEWAY_URL ||
      process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL ||
      "https://ipfs.io/ipfs",
    pinTokenId: process.env.PIN_TOKEN_ID || process.env.NEXT_PUBLIC_PIN_TOKEN_ID || "",
    pinFeeAmount: process.env.PIN_FEE_AMOUNT || process.env.NEXT_PUBLIC_PIN_FEE_AMOUNT || "",
    pinTreasuryAccountId:
      process.env.PIN_TREASURY_ACCOUNT_ID || process.env.NEXT_PUBLIC_PIN_TREASURY_ACCOUNT_ID || "",
    pinFeeContractAddress:
      process.env.PIN_FEE_CONTRACT_ADDRESS ||
      process.env.NEXT_PUBLIC_PIN_FEE_CONTRACT_ADDRESS ||
      "",
    hashScanBase:
      process.env.NEXT_PUBLIC_HASHSCAN_BASE ||
      `https://hashscan.io/${network}`,
  };
}

export function pinFeeEnabled(env: VaultEnv = getVaultEnv()): boolean {
  return Boolean(env.pinTokenId && env.pinFeeAmount && env.pinTreasuryAccountId);
}

/** Native HBAR pin fee when PIN_TOKEN_ID is HBAR or 0.0.0 */
export function pinFeeIsHbar(env: VaultEnv = getVaultEnv()): boolean {
  const id = env.pinTokenId.trim().toUpperCase();
  return id === "HBAR" || id === "0.0.0";
}
