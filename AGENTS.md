# AGENTS.md — HCS-IPFS Document Vault

Guidance for AI coding agents and humans extending this Scaffold-HBAR template.

## Layout

| Path | Responsibility |
| --- | --- |
| `packages/ledger` | Pure TS: sha256, attestation schema parse/serialize, HashScan/IPFS URLs, bigint money. **No network I/O.** |
| `packages/hardhat` | Optional `PinFeeCollector.sol` + deploy/tests. Non-custodial pin fee sink. |
| `packages/nextjs` | App Router UI (`/`, `/upload`, `/verify`), API routes, `demo:attest` / `demo:topic` scripts. |
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

## Non-negotiables

1. **IPFS is load-bearing** — bytes on IPFS (dry-run CID only for demos). Remove IPFS → product breaks; HCS alone only notarizes a hash.
2. **HCS is load-bearing** — attestation JSON on a topic; Mirror Node for reads.
3. **No custodial hop** — pin fees go payer → treasury/merchant, never through an intermediary wallet you control as escrow.
4. **bigint for money** — no floats for HBAR/HTS amounts.
5. **No secrets in git** — no private keys, no committed `.env`.
6. **Yarn + npm** — depend on workspace packages with `"@scope/pkg": "*"`, not `workspace:*`.
7. **Do not clone** official templates’ product niches (x402 S3 paywall, SaucerSwap checkout, etc.) into this vault.
8. **Do not invent another product** — this template is the HCS-anchored IPFS document vault only.

## Hedera patterns in use

- `@hashgraph/sdk`: `TopicCreateTransaction`, `TopicMessageSubmitTransaction`
- Mirror Node REST: `/api/v1/topics/{id}/messages`
- Optional HIP-336: `AccountAllowanceApproveTransaction` + `TransferTransaction`
- Optional EVM: `PinFeeCollector` (`payPinHbar` / `payPinToken`)

## Definition of done

- [ ] `template.json` present and Zod-valid for create-scaffold-hbar
- [ ] `README.md`, `AGENTS.md`, `RUNBOOK.md`, MIT `LICENSE`, `.env.example`
- [ ] `yarn install` and `npm install` both work in a fresh tree
- [ ] `yarn lint`, `yarn test`, `yarn build` green
- [ ] App boots; `/upload` and `/verify` OK
- [ ] One real testnet HCS submit with HashScan/Mirror link in README Status table
- [ ] IPFS documented as required decentralised-storage integration; README states what breaks without it; dry-run CID path documented

## Safe changes

- Prefer extending `@vault/ledger` for schema/hash helpers + unit tests.
- Keep API routes thin wrappers around `lib/hedera.ts` / `lib/ipfs.ts`.
- When adding env vars, update `.env.example`, `template.json` `envVars`, and README table together.

## Unsafe changes

- Committing faucet keys or `.env`
- Switching money math to `number`
- Routing pin fees through a custodial server wallet
- Replacing IPFS with only local disk / S3 without content addressing
