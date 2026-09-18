# RUNBOOK — Testnet walkthrough

Click-by-click path from zero to a HashScan attestation link.

## 0. Machine setup

1. Install Node ≥ 20.18.3.
2. From the repo root, Yarn is already pinned: `.yarn/releases/yarn-3.2.3.cjs`.
3. Optional: install Kubo and run `ipfs daemon` (API `http://127.0.0.1:5001`).

## 1. Install

```bash
cp .env.example .env
cp packages/nextjs/.env.example packages/nextjs/.env.local
yarn install
# prove npm as well in a second clone, or:
# rm -rf node_modules packages/*/node_modules && npm install
```

## 2. Fund an account

1. Open https://portal.hedera.com/faucet
2. Create or select a testnet account.
3. Put values in `.env`:

```env
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.YOUR_ID
HEDERA_PRIVATE_KEY=your_private_key
```

Never commit this file.

## 3. Create an HCS topic

```bash
yarn demo:topic
```

Expected: prints `HCS_TOPIC_ID=0.0.…` and a HashScan transaction URL; updates `.env` when present.

## 4. One-click attest

With Kubo running:

```bash
yarn demo:attest
```

Without Kubo (HCS-only dry-run CID):

```bash
DEMO_PRECOMPUTED_CID=bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi yarn demo:attest
```

Expected stdout includes:

- `sequenceNumber=…`
- `HashScan topic message: https://hashscan.io/testnet/topic/0.0.…/…`

Copy that URL into the README Status table.

npm equivalent:

```bash
npm run demo:attest -w @vault/nextjs
```

## 5. Run the UI

```bash
yarn next:dev
```

1. Open http://localhost:3000
2. **Upload** — choose a file (or paste precomputed CID) → Upload → IPFS → HCS attest
3. Note the sequence number and HashScan links
4. **Verify** — paste the CID → Verify on HCS → open HashScan / Fetch from IPFS

## 6. Optional pin fee

1. Create or choose an HTS fungible token on testnet.
2. Associate payer + treasury as needed.
3. Set:

```env
PIN_TOKEN_ID=0.0.TOKEN
PIN_FEE_AMOUNT=1000000
PIN_TREASURY_ACCOUNT_ID=0.0.TREASURY
```

4. Re-run `yarn demo:attest` — logs should show `pinFee={…}` with allowance + transfer tx ids.

Optional contract path:

```bash
yarn hardhat:compile
yarn hardhat:test
# set HEDERA_EVM_PRIVATE_KEY / PIN_TREASURY_EVM_ADDRESS then:
yarn hardhat:deploy --network hederaTestnet
```

## 7. Lint / test / build gate

```bash
yarn lint
yarn test
yarn build
```

All three should exit 0 before submission.

## 8. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `IPFS API unreachable` | Start `ipfs daemon` or use precomputed CID / `DEMO_PRECOMPUTED_CID` |
| `HCS_TOPIC_ID is required` | `yarn demo:topic` |
| `Unable to parse HEDERA_PRIVATE_KEY` | Use ECDSA or ED25519 hex/DER from the portal; no quotes |
| Mirror verify empty | Wait a few seconds after submit; confirm topic id |
| npm workspace resolve fails | Ensure deps use `"@vault/ledger": "*"` and workspaces listed in root `package.json` |

## 9. Eligibility reminders

- MIT licence, original work, no committed secrets
- At least one verifiable testnet tx (HashScan or Mirror link in README)
- Fresh scaffold install/lint/build must pass
