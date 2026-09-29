import {
  AccountId,
  Client,
  PrivateKey,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  Status,
  Hbar,
  TokenId,
  AccountAllowanceApproveTransaction,
  TransferTransaction,
} from "@hashgraph/sdk";
import {
  buildVaultAttestation,
  collectMirrorPages,
  serializeVaultAttestation,
  hashScanTopicMessageUrl,
  hashScanTransactionUrl,
  mirrorTopicMessagesUrl,
  mirrorTopicMessageUrl,
  type MirrorMessagesPage,
  type PagedMessages,
  type VaultAttestation,
} from "@vault/ledger";
import { getVaultEnv, pinFeeEnabled, pinFeeIsHbar, type VaultEnv } from "./env";

function parsePrivateKey(raw: string): PrivateKey {
  const trimmed = raw.trim();
  // Raw 32-byte hex is ambiguous: try ECDSA (portal default), then ED25519. Longer strings are
  // DER, which encodes the key type (fromStringECDSA would mis-read ED25519 DER as ECDSA).
  const isRaw = /^(0x)?[0-9a-f]{64}$/i.test(trimmed);
  const attempts: Array<() => PrivateKey> = isRaw
    ? [() => PrivateKey.fromStringECDSA(trimmed), () => PrivateKey.fromStringED25519(trimmed)]
    : [() => PrivateKey.fromStringDer(trimmed)];
  let last: unknown;
  for (const attempt of attempts) {
    try {
      return attempt();
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`Unable to parse HEDERA_PRIVATE_KEY: ${String(last)}`);
}

export function createOperatorClient(env: VaultEnv = getVaultEnv()): Client {
  if (!env.accountId || !env.privateKey) {
    throw new Error("HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY are required");
  }
  const client =
    env.network === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  const key = parsePrivateKey(env.privateKey);
  client.setOperator(AccountId.fromString(env.accountId), key);
  return client;
}

/**
 * Resolve HCS_SUBMIT_KEY: "" → none (public topic), "operator" → HEDERA_PRIVATE_KEY,
 * anything else → parsed as a private key.
 */
export function resolveSubmitKey(env: VaultEnv = getVaultEnv()): PrivateKey | null {
  const raw = env.hcsSubmitKey.trim();
  if (!raw) return null;
  if (raw.toLowerCase() === "operator") {
    if (!env.privateKey) throw new Error("HCS_SUBMIT_KEY=operator requires HEDERA_PRIVATE_KEY");
    return parsePrivateKey(env.privateKey);
  }
  try {
    return parsePrivateKey(raw);
  } catch {
    throw new Error("HCS_SUBMIT_KEY is not a valid private key (or use HCS_SUBMIT_KEY=operator)");
  }
}

export async function createVaultTopic(memo = "hcs-ipfs-document-vault"): Promise<{
  topicId: string;
  transactionId: string;
  hashScanUrl: string;
  submitKeyPublic: string | null;
}> {
  const env = getVaultEnv();
  const submitKey = resolveSubmitKey(env);
  const client = createOperatorClient(env);
  try {
    const create = new TopicCreateTransaction()
      .setTopicMemo(memo)
      .setMaxTransactionFee(new Hbar(2));
    // With a submit key only holders of that key can post attestations to the topic.
    if (submitKey) create.setSubmitKey(submitKey.publicKey);
    const tx = await create.execute(client);
    const receipt = await tx.getReceipt(client);
    const topicId = receipt.topicId?.toString();
    if (!topicId) throw new Error("TopicCreate did not return topicId");
    const transactionId = tx.transactionId.toString();
    return {
      topicId,
      transactionId,
      hashScanUrl: hashScanTransactionUrl(transactionId, env.network),
      submitKeyPublic: submitKey ? submitKey.publicKey.toStringDer() : null,
    };
  } finally {
    client.close();
  }
}

export type AttestResult = {
  attestation: VaultAttestation;
  topicId: string;
  sequenceNumber: string;
  transactionId: string;
  hashScanTopicUrl: string;
  hashScanTxUrl: string;
  pinFee?: {
    enabled: true;
    tokenId: string;
    amount: string;
    treasury: string;
    allowanceTxId?: string;
    transferTxId?: string;
  };
};

/**
 * Optional HIP-336 style pin fee: payer approves allowance then CryptoTransfer
 * moves tokens payer → treasury (non-custodial). Skipped when PIN_TOKEN_ID unset.
 */
async function maybePayPinFee(
  client: Client,
  env: VaultEnv,
): Promise<AttestResult["pinFee"] | undefined> {
  if (!pinFeeEnabled(env)) return undefined;
  const amount = BigInt(env.pinFeeAmount);
  if (amount <= 0n) {
    throw new Error("PIN_FEE_AMOUNT must be a positive bigint string in base units");
  }
  const treasury = AccountId.fromString(env.pinTreasuryAccountId);
  const payer = AccountId.fromString(env.accountId);

  // Native HBAR pin fee (PIN_TOKEN_ID=HBAR|0.0.0): single CryptoTransfer payer → treasury.
  if (pinFeeIsHbar(env)) {
    const hbarAmount = Hbar.fromTinybars(amount.toString());
    const transfer = await new TransferTransaction()
      .addHbarTransfer(payer, hbarAmount.negated())
      .addHbarTransfer(treasury, hbarAmount)
      .freezeWith(client)
      .execute(client);
    const transferReceipt = await transfer.getReceipt(client);
    if (transferReceipt.status !== Status.Success) {
      throw new Error(`HBAR pin fee transfer failed: ${transferReceipt.status.toString()}`);
    }
    return {
      enabled: true,
      tokenId: "0.0.0",
      amount: amount.toString(),
      treasury: env.pinTreasuryAccountId,
      transferTxId: transfer.transactionId.toString(),
    };
  }

  const tokenId = TokenId.fromString(env.pinTokenId);

  // HIP-336: payer approves treasury (or contract) as spender for the pin amount.
  // Then a payer-signed CryptoTransfer moves tokens payer → treasury (non-custodial).
  const spender = env.pinFeeContractAddress
    ? AccountId.fromString(env.pinTreasuryAccountId)
    : treasury;

  const approve = await new AccountAllowanceApproveTransaction()
    .approveTokenAllowance(tokenId, payer, spender, amount)
    .freezeWith(client)
    .execute(client);
  const approveReceipt = await approve.getReceipt(client);
  if (approveReceipt.status !== Status.Success) {
    throw new Error(`Allowance approve failed: ${approveReceipt.status.toString()}`);
  }

  const transfer = await new TransferTransaction()
    .addTokenTransfer(tokenId, payer, amount * -1n)
    .addTokenTransfer(tokenId, treasury, amount)
    .freezeWith(client)
    .execute(client);
  const transferReceipt = await transfer.getReceipt(client);
  if (transferReceipt.status !== Status.Success) {
    throw new Error(`Pin fee transfer failed: ${transferReceipt.status.toString()}`);
  }

  return {
    enabled: true,
    tokenId: env.pinTokenId,
    amount: amount.toString(),
    treasury: env.pinTreasuryAccountId,
    allowanceTxId: approve.transactionId.toString(),
    transferTxId: transfer.transactionId.toString(),
  };
}

export async function submitAttestation(params: {
  cid: string;
  sha256: string;
  size: number;
  memo?: string;
  topicId?: string;
  mime?: string;
  prevCid?: string;
}): Promise<AttestResult> {
  const env = getVaultEnv();
  const topicId = params.topicId || env.topicId;
  if (!topicId) throw new Error("HCS_TOPIC_ID is required (or pass topicId)");

  const attestation = buildVaultAttestation({
    cid: params.cid,
    sha256: params.sha256,
    size: params.size,
    payer: env.accountId,
    memo: params.memo ?? "vault-attest",
    ts: Date.now(),
    mime: params.mime,
    prevCid: params.prevCid,
  });
  const body = serializeVaultAttestation(attestation);

  const client = createOperatorClient(env);
  try {
    const pinFee = await maybePayPinFee(client, env);

    const submit = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(body)
      .setMaxTransactionFee(new Hbar(2))
      .freezeWith(client);
    // Topics created with a submit key reject messages not signed by it.
    const submitKey = resolveSubmitKey(env);
    if (submitKey) await submit.sign(submitKey);
    const tx = await submit.execute(client);
    const receipt = await tx.getReceipt(client);
    if (receipt.status !== Status.Success) {
      throw new Error(`TopicMessageSubmit failed: ${receipt.status.toString()}`);
    }
    const sequenceNumber = receipt.topicSequenceNumber?.toString() ?? "unknown";
    const transactionId = tx.transactionId.toString();

    return {
      attestation,
      topicId,
      sequenceNumber,
      transactionId,
      // Receipt has no consensus timestamp -> topic Messages tab; hashScanTxUrl opens this exact message.
      hashScanTopicUrl: hashScanTopicMessageUrl(topicId, sequenceNumber, env.network),
      hashScanTxUrl: hashScanTransactionUrl(transactionId, env.network),
      pinFee,
    };
  } finally {
    client.close();
  }
}

export type MirrorTopicMessage = {
  consensus_timestamp: string;
  topic_id: string;
  message: string;
  sequence_number: number;
  running_hash?: string;
  payer_account_id?: string;
};

async function mirrorGetJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Mirror Node error ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/**
 * All topic messages (newest first by default), following Mirror `links.next`
 * up to `maxPages` × `limit` messages.
 */
export async function fetchTopicMessages(
  topicId: string,
  opts: { limit?: number; order?: "asc" | "desc"; maxPages?: number; mirrorNodeUrl?: string } = {},
): Promise<PagedMessages<MirrorTopicMessage>> {
  const url = mirrorTopicMessagesUrl(topicId, {
    networkOrUrl: opts.mirrorNodeUrl ?? getVaultEnv().mirrorNodeUrl,
    limit: opts.limit ?? 100,
    order: opts.order ?? "desc",
  });
  return collectMirrorPages(url, (u) => mirrorGetJson<MirrorMessagesPage<MirrorTopicMessage>>(u), {
    maxPages: opts.maxPages,
  });
}

/** Fetch one HCS message by sequence via Mirror Node REST (null on 404). */
export async function fetchTopicMessageBySequence(
  topicId: string,
  sequenceNumber: string | number,
  mirrorNodeUrl: string = getVaultEnv().mirrorNodeUrl,
): Promise<MirrorTopicMessage | null> {
  const url = mirrorTopicMessageUrl(topicId, sequenceNumber, mirrorNodeUrl);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Mirror Node error ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as MirrorTopicMessage;
}
