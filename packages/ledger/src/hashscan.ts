/** Build HashScan URLs for topic / transaction / account. */

export type HashScanNetwork = "testnet" | "mainnet" | "previewnet" | string;

export function hashScanBase(network: HashScanNetwork = "testnet"): string {
  const n = network || "testnet";
  return `https://hashscan.io/${n}`;
}

export function hashScanTopicUrl(topicId: string, network: HashScanNetwork = "testnet"): string {
  return `${hashScanBase(network)}/topic/${topicId}`;
}

export function hashScanTopicMessageUrl(
  topicId: string,
  sequenceNumber: string | number,
  network: HashScanNetwork = "testnet",
): string {
  return `${hashScanBase(network)}/topic/${topicId}/${sequenceNumber}`;
}

export function hashScanTransactionUrl(
  transactionId: string,
  network: HashScanNetwork = "testnet",
): string {
  // HashScan expects transaction ids with @ and . as in SDK toString()
  return `${hashScanBase(network)}/transaction/${encodeURIComponent(transactionId)}`;
}

export function hashScanAccountUrl(accountId: string, network: HashScanNetwork = "testnet"): string {
  return `${hashScanBase(network)}/account/${accountId}`;
}

/** IPFS gateway fetch URL for a CID. */
export function ipfsGatewayUrl(cid: string, gatewayBase = "https://ipfs.io/ipfs"): string {
  const base = gatewayBase.replace(/\/$/, "");
  return `${base}/${cid}`;
}
