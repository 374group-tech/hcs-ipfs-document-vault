# HCS attestation schema

Vault attestations are compact JSON messages submitted via `TopicMessageSubmitTransaction`.

## Schema v1 (current writes)

```json
{
  "schemaVersion": 1,
  "cid": "bafy…",
  "sha256": "<64 hex lowercase>",
  "size": 1234,
  "payer": "0.0.x",
  "memo": "vault-attest",
  "ts": 1700000000000,
  "mime": "application/pdf",
  "prevCid": "bafy…"
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `schemaVersion` | yes (on write) | Always `1` for new messages |
| `cid` | yes | IPFS CID (v0/v1) |
| `sha256` | yes | 64-char hex digest of document bytes |
| `size` | yes | Byte length (non-negative integer) |
| `payer` | yes | Hedera account `0.0.x` that paid the submit |
| `memo` | yes | Short string (may be empty) |
| `ts` | yes | Unix epoch ms (or seconds) at attest time |
| `mime` | no | MIME type when known |
| `prevCid` | no | Prior document CID for a revision chain |

## Legacy (pre-v1)

Messages **without** `schemaVersion` are still valid. They only have
`cid`, `sha256`, `size`, `payer`, `memo`, `ts`.

Verify paths (`yarn verify:proof`, `/verify`, `GET /api/hcs/verify`) accept **both** shapes.

## Why this pattern

IPFS holds the bytes (CID). HCS notarizes the CID + content hash on a public,
ordered, tamper-evident topic. `prevCid` lets you link revisions without mutating
history — each attest is append-only.

See README **Why this pattern** and `@vault/ledger` `parseVaultAttestation` /
`serializeVaultAttestation`.

## Demo helpers

- New writes always go through `serializeVaultAttestation` / `buildVaultAttestation` (schema v1).
- CLI: `DEMO_PREV_CID=<priorCid> DEMO_MIME=text/plain yarn demo:attest` sets optional revision fields.
- Verify: `yarn verify:proof <CID>` prints `schemaVersion=1` or `schemaVersion=legacy`.

