# AGENTS.md — HCS-IPFS Document Vault

Guidance for AI coding agents and humans extending this Scaffold-HBAR template.

## 5-minute path (keep docs in sync)

Judges and developers follow the root README **5-minute path**. When changing scripts or env, update README + [docs/DEMO.md](./docs/DEMO.md) + [RUNBOOK.md](./RUNBOOK.md) together.

```bash
cp .env.example .env          # HEDERA_ACCOUNT_ID + HEDERA_PRIVATE_KEY
yarn install
yarn demo:topic               # → HCS_TOPIC_ID
ipfs daemon &                 # or DEMO_PRECOMPUTED_CID dry-run
yarn demo:attest              # → sequence + HashScan URL
yarn next:dev                 # /upload → /verify
```

Gate: `yarn lint && yarn test && yarn build`.

## Layout

| Path | Responsibility |
| --- | --- |
| `packages/ledger` | Pure TS: sha256, attestation schema, HashScan/Mirror/IPFS URLs, bigint money. **No network I/O.** |
| `packages/hardhat` | Optional `PinFeeCollector.sol` + deploy/tests. Non-custodial pin fee sink. |
| `packages/nextjs` | App Router UI (`/`, `/upload`, `/verify`), API routes, `demo:attest` / `demo:topic` scripts. |
| `docs/DEMO.md` | Judge-facing walkthrough + Mermaid + screenshot placeholders. |
| `template.json` | create-scaffold-hbar manifest. `envVars` = `{key, description}` only. |
| `.env.example` | Documented env — **never commit `.env`**. |

## Ecosystem integration (rubric 35 pts)

**IPFS = decentralised storage**, load-bearing for this template — not a decorative import.

| Keep | Breaks if removed |
| --- | --- |
| IPFS holds document bytes → CID | No durable blob / CID; nowhere to put or fetch the file |
| HCS attests `{cid, sha256, size, payer, memo, ts}` | No public, ordered, tamper-evident proof |
| Mirror + HashScan verify; optional HIP-336 / native HBAR pin | (pin is optional; HCS+IPFS are not) |

Flow: **upload → CID → sha256 → HCS attest → verify (Mirror/HashScan) + fetch from IPFS**. HashScan proofs live in README **Status & roadmap**.

### IPFS (load-bearing — do not weaken)

- Happy path: `POST /api/ipfs/add` → Kubo at `IPFS_API_URL`.
- Dry-run CID (`DEMO_PRECOMPUTED_CID` / UI field) is **demo only**; production needs real bytes on IPFS.
- README and this file must keep stating: remove IPFS → product breaks (HCS alone only notarizes a hash of bytes it never held).

## Non-negotiables

1. **IPFS is load-bearing** — bytes on IPFS (dry-run CID only for demos). Remove IPFS → product breaks.
2. **HCS is load-bearing** — attestation JSON on a topic; Mirror Node for reads.
3. **No custodial hop** — pin fees go payer → treasury/merchant, never through an intermediary wallet you control as escrow.
4. **bigint for money** — no floats for HBAR/HTS amounts.
5. **No secrets in git** — no private keys, no committed `.env`.
6. **Yarn + npm** — depend on workspace packages with `"@scope/pkg": "*"`, not `workspace:*`.
7. **Do not clone** official templates’ product niches (x402 S3 paywall, SaucerSwap checkout, etc.) into this vault.
8. **Do not invent another product** — this template is the HCS-anchored IPFS document vault only.

## Hedera patterns in use

- `@hashgraph/sdk`: `TopicCreateTransaction`, `TopicMessageSubmitTransaction`
- Mirror Node REST: `/api/v1/topics/{id}/messages` (+ optional `…/messages/{seq}`)
- Optional HIP-336: `AccountAllowanceApproveTransaction` + `TransferTransaction`
- Optional EVM: `PinFeeCollector` (`payPinHbar` / `payPinToken`)

## Definition of done

- [ ] `template.json` present and Zod-valid for create-scaffold-hbar
- [ ] `README.md` (incl. **5-minute path** + troubleshooting), `AGENTS.md`, `RUNBOOK.md`, `docs/DEMO.md`, MIT `LICENSE`, `.env.example`
- [ ] `yarn install` and `npm install` both work in a fresh tree
- [ ] `yarn lint`, `yarn test`, `yarn build` green
- [ ] App boots; `/upload` and `/verify` OK
- [ ] One real testnet HCS submit with HashScan/Mirror link in README Status table
- [ ] IPFS documented as required decentralised-storage integration; README states what breaks without it; dry-run CID path documented

## Safe changes

- Prefer extending `@vault/ledger` for schema/hash/URL helpers + unit tests.
- Keep API routes thin wrappers around `lib/hedera.ts` / `lib/ipfs.ts`.
- When adding env vars, update `.env.example`, `template.json` `envVars`, and README env table together.
- Deepen verify via Mirror Node (topic / seq / consensus timestamp + HashScan) rather than adding decorative DEX/oracle features.

## Unsafe changes

- Committing faucet keys or `.env`
- Switching money math to `number`
- Routing pin fees through a custodial server wallet
- Replacing IPFS with only local disk / S3 without content addressing
- Half-baked DEX, oracle, or unrelated product pivots
