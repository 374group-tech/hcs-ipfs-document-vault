# Demo assets (screenshots / diagrams)

Judges can follow [docs/DEMO.md](../DEMO.md) without screenshots — live HashScan links in the root README **Status & roadmap** are the proof of record.

## Included

| File | Purpose |
| --- | --- |
| [architecture.svg](./architecture.svg) | One-pager: User → Next.js → IPFS + HCS → Mirror/HashScan (+ optional pin fee) |

## Screenshots to capture (optional, founder / video)

Drop real PNGs here when you record the demo video. Suggested names match [docs/DEMO.md](../DEMO.md):

| File | Capture |
| --- | --- |
| `01-upload.png` | `/upload` — file chosen or CID shown before/after IPFS add |
| `02-attest.png` | Attest result: sequence number, HashScan link, schema v1 JSON snippet |
| `03-verify.png` | `/verify` match: topic / seq / consensus timestamp / HashScan |
| `04-verify-proof.png` | Terminal: `yarn verify:proof … --sequence 4` → `match=yes` `schemaVersion=1` |
| `05-hashscan.png` | HashScan topic message page for seq 4 (schema v1) |

Do **not** commit secrets, `.env`, or wallet seed screenshots. Prefer testnet-only accounts.

Until PNGs exist, use the SVG above + README Status HashScan links.
