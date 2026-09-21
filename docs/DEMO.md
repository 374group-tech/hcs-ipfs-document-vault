# Demo walkthrough (judges / developers)

Five minutes from clone → HashScan proof. Screenshots are placeholders — drop real captures under `docs/assets/` if you record them.

## Path (CLI)

```text
.env keys → yarn install → yarn demo:topic → (ipfs daemon) → yarn demo:attest → HashScan URL
```

```bash
cp .env.example .env
# set HEDERA_ACCOUNT_ID + HEDERA_PRIVATE_KEY (portal faucet)
yarn install
yarn demo:topic          # writes HCS_TOPIC_ID
ipfs daemon &            # or skip and use DEMO_PRECOMPUTED_CID (dry-run)
yarn demo:attest         # prints sequenceNumber + HashScan topic message URL
```

Dry-run (HCS-only, no Kubo):

```bash
DEMO_PRECOMPUTED_CID=bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi \
  yarn demo:attest
```

## Path (UI)

```bash
yarn next:dev
# http://localhost:3000/upload  → file or precomputed CID → attest
# http://localhost:3000/verify  → paste CID → Mirror Node match + HashScan
```

## Flow diagram

```mermaid
sequenceDiagram
  participant Dev
  participant UI as Next.js
  participant IPFS as Kubo / gateway
  participant HCS as Hedera HCS
  participant Mirror as Mirror Node
  Dev->>UI: upload bytes + sha256
  UI->>IPFS: POST /api/v0/add
  IPFS-->>UI: CID
  UI->>HCS: TopicMessageSubmit {cid,sha256,…}
  HCS-->>UI: sequence + consensus
  Dev->>UI: verify CID
  UI->>Mirror: GET /topics/{id}/messages
  Mirror-->>UI: match + HashScan link
  UI->>IPFS: fetch gateway URL
```

## Screenshot placeholders

| Step | Placeholder | What to capture |
| --- | --- | --- |
| 1. Upload | `![upload](./assets/01-upload.png)` | `/upload` with file chosen / CID shown |
| 2. Attest result | `![attest](./assets/02-attest.png)` | Sequence number + HashScan link |
| 3. Verify match | `![verify](./assets/03-verify.png)` | Topic / seq / consensus timestamp / HashScan |
| 4. HashScan | `![hashscan](./assets/04-hashscan.png)` | Topic message page on testnet |

Create `docs/assets/` when you add real PNGs. Until then, the Mermaid diagram + live HashScan links in the root README **Status & roadmap** are enough for judges.

## Live proof (reference)

See README **Status & roadmap** for the current testnet topic / sequence / pin-fee transfer URLs.
