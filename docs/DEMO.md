# Demo walkthrough (judges / developers)

Five minutes from clone → HashScan proof → `yarn verify:proof`. Screenshots are placeholders — drop real captures under `docs/assets/` if you record them.

## Path (CLI)

```text
.env keys → yarn install → yarn demo:topic → (ipfs daemon | pinata) → yarn demo:attest → yarn verify:proof <CID> → HashScan
```

```bash
cp .env.example .env
# set HEDERA_ACCOUNT_ID + HEDERA_PRIVATE_KEY (portal faucet)
yarn install
yarn demo:topic          # writes HCS_TOPIC_ID
ipfs daemon &            # or IPFS_PROVIDER=pinata + PINATA_JWT; or DEMO_PRECOMPUTED_CID dry-run
yarn demo:attest         # prints sequenceNumber + HashScan (writes schema v1)
# Optional revision chain:
# DEMO_PREV_CID=<priorCid> DEMO_MIME=text/plain yarn demo:attest
yarn verify:proof <CID>  # Mirror Node match → exit 0/1 (accepts legacy + schema v1)
```

Dry-run (HCS-only, no Kubo/Pinata):

```bash
DEMO_PRECOMPUTED_CID=bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi \
  yarn demo:attest
```

## Path (UI)

```bash
yarn next:dev
# http://localhost:3000/upload  → file or precomputed CID → attest (schema v1)
# http://localhost:3000/verify  → paste CID → Mirror Node match + HashScan
# CLI equivalent: yarn verify:proof <CID>
```

## Flow diagram

```mermaid
sequenceDiagram
  participant Dev
  participant UI as Next.js
  participant IPFS as Kubo / Pinata / gateway
  participant HCS as Hedera HCS
  participant Mirror as Mirror Node
  Dev->>UI: upload bytes + sha256
  UI->>IPFS: add (kubo or pinata)
  IPFS-->>UI: CID
  UI->>HCS: TopicMessageSubmit schema v1 {schemaVersion,cid,sha256,…}
  HCS-->>UI: sequence + consensus
  Dev->>UI: verify CID (or yarn verify:proof)
  UI->>Mirror: GET /topics/{id}/messages
  Mirror-->>UI: match + HashScan link
  UI->>IPFS: fetch gateway URL
```

## Screenshot placeholders

| Step | Placeholder | What to capture |
| --- | --- | --- |
| 1. Upload | `![upload](./assets/01-upload.png)` | `/upload` with file chosen / CID shown |
| 2. Attest result | `![attest](./assets/02-attest.png)` | Sequence number + HashScan link + schema v1 JSON |
| 3. Verify match | `![verify](./assets/03-verify.png)` | Topic / seq / consensus timestamp / HashScan |
| 4. CLI verify | `![cli](./assets/04-verify-proof.png)` | `yarn verify:proof` stdout `match=yes` |
| 5. HashScan | `![hashscan](./assets/05-hashscan.png)` | Topic message page on testnet |

Create `docs/assets/` when you add real PNGs. Until then, the Mermaid diagram + live HashScan links in the root README **Status & roadmap** are enough for judges.

## Live proof (reference)

See README **Status & roadmap** — schema v1 seq **4** and legacy seq **3** on topic `0.0.10600873`.
