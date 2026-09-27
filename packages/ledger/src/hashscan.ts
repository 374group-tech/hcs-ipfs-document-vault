/** Build HashScan URLs for topic / transaction / account. */

export type HashScanNetwork = "testnet" | "mainnet" | "previewnet" | string;

export function hashScanBase(network: HashScanNetwork = "testnet"): string {
  const n = network || "testnet";
  return `https://hashscan.io/${n}`;
}

export function hashScanTopicUrl(topicId: string, network: HashScanNetwork = "testnet"): string {
  return `${hashScanBase(network)}/topic/${topicId}`;
}

/**
 * HashScan link for one HCS topic message.
 *
 * HashScan has no `/topic/<id>/<sequence>` route (it renders "page not found").
 * A single message is addressable via its consensus timestamp
 * (`/transaction/<seconds.nanos>`); without one we fall back to the topic's
 * Messages tab (`/topic/<id>/messages`). `sequenceNumber` is kept for API
 * compatibility and callers' logging.
 */
export function hashScanTopicMessageUrl(
  topicId: string,
  _sequenceNumber: string | number,
  network: HashScanNetwork = "testnet",
  consensusTimestamp?: string,
): string {
  const base = hashScanBase(network);
  if (consensusTimestamp && /^\d+\.\d+$/.test(consensusTimestamp)) {
    return `${base}/transaction/${consensusTimestamp}`;
  }
  return `${base}/topic/${topicId}/messages`;
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

/** Mirror Node REST base helpers (read path for HCS verify). */

export function mirrorNodeBase(
  networkOrUrl: HashScanNetwork | string = "testnet",
): string {
  if (/^https?:\/\//i.test(networkOrUrl)) {
    return networkOrUrl.replace(/\/$/, "");
  }
  const n = networkOrUrl || "testnet";
  if (n === "mainnet") return "https://mainnet.mirrornode.hedera.com";
  if (n === "previewnet") return "https://previewnet.mirrornode.hedera.com";
  return "https://testnet.mirrornode.hedera.com";
}

/** List endpoint: GET /api/v1/topics/{topicId}/messages */
export function mirrorTopicMessagesUrl(
  topicId: string,
  opts: {
    networkOrUrl?: HashScanNetwork | string;
    limit?: number;
    order?: "asc" | "desc";
  } = {},
): string {
  const base = mirrorNodeBase(opts.networkOrUrl ?? "testnet");
  const limit = opts.limit ?? 100;
  const order = opts.order ?? "desc";
  return `${base}/api/v1/topics/${topicId}/messages?limit=${limit}&order=${order}`;
}

/** Single message: GET /api/v1/topics/{topicId}/messages/{sequenceNumber} */
export function mirrorTopicMessageUrl(
  topicId: string,
  sequenceNumber: string | number,
  networkOrUrl: HashScanNetwork | string = "testnet",
): string {
  const base = mirrorNodeBase(networkOrUrl);
  return `${base}/api/v1/topics/${topicId}/messages/${sequenceNumber}`;
}

/**
 * Hedera consensus_timestamp is "seconds.nanoseconds".
 * Returns a UTC ISO-ish string for UI (ms precision) or the raw input if unparsable.
 */
export function formatConsensusTimestamp(consensusTimestamp: string): string {
  if (!consensusTimestamp || typeof consensusTimestamp !== "string") return "";
  const [secStr, nanoStr = "0"] = consensusTimestamp.split(".");
  const sec = Number(secStr);
  if (!Number.isFinite(sec)) return consensusTimestamp;
  const nanos = Number((nanoStr + "000000000").slice(0, 9));
  const ms = sec * 1000 + Math.floor(nanos / 1e6);
  try {
    return new Date(ms).toISOString();
  } catch {
    return consensusTimestamp;
  }
}
