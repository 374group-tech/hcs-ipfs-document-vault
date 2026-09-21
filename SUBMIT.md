# Submission checklist (Scaffold-HBAR Template Bounty)

Repo (keep **private until 2026-09-21**, then public):
`https://github.com/374group-tech/hcs-ipfs-document-vault`

## Before submit (after 21.09.2026)

1. [x] Make the GitHub repo **public** (confirmed 2026-09-21)
2. [x] Confirm MIT `LICENSE` is present (GitHub license=MIT)
3. [x] Re-run fresh scaffold (2026-09-21 PASS):
   ```bash
   npm create scaffold-hbar@latest --template 374group-tech/hcs-ipfs-document-vault
   ```
4. [x] From a fresh scaffold: install + compile + lint + build PASS (2026-09-21); routes `/` `/upload` `/verify` in Next build output
5. [ ] Paste HashScan proof (already in README Status):
   - Topic: https://hashscan.io/testnet/topic/0.0.10600873
   - Message seq 3: https://hashscan.io/testnet/topic/0.0.10600873/3
6. [ ] Fill Hedera **dev-ex survey** (link from bounty submit form)
7. [ ] Optional AMA: 2026-09-29 10:00 ET
8. [ ] Submit before **2026-10-04 23:59 ET** (= 2026-10-05 07:59 Yerevan)

## Do not submit

- `.env` / private keys
- `node_modules`
- Any Bitluma / AgentBazaar / other-team code

## Local gate re-check (2026-09-18)

- [x] `yarn lint` + `yarn build` PASS after HBAR pin-fee path
- [x] `create-scaffold-hbar@0.4.0` from local template dir PASS (`CREATE_SCAFFOLD_HBAR_TEMPLATE_DIR=…`)
- [x] Official public-repo scaffold after 21.09 (2026-09-21 PASS): `npm create scaffold-hbar@latest -- --template 374group-tech/hcs-ipfs-document-vault --yes --skip-hedera-skills --package-manager yarn --skip-install --frontend nextjs-app --solidity-framework hardhat --network testnet` then yarn install / hardhat compile / lint / build

## Proof already live

IPFS is the **35-pt ecosystem integration** (decentralised storage): load-bearing — remove it and there is no durable document blob/CID; HCS alone only notarizes a hash. See README “Why this pattern” + Status table.

| Item | Link |
| --- | --- |
| HCS topic | https://hashscan.io/testnet/topic/0.0.10600873 |
| IPFS+HCS+pin attest | https://hashscan.io/testnet/topic/0.0.10600873/3 |
| Pin fee transfer | https://hashscan.io/testnet/transaction/0.0.10600860%401789747920.746708423 |

## Official public scaffold gate (2026-09-21 Asia/Yerevan)

- Repo public + MIT: PASS
- `npm create scaffold-hbar@latest --template 374group-tech/hcs-ipfs-document-vault` (with `--yes --solidity-framework hardhat`; CLI otherwise probes Foundry): PASS
- Fresh `yarn install` + `yarn hardhat:compile` + `yarn lint` + `yarn build`: PASS
- Note: bare `yarn lint` before first compile failed on missing `typechain-types`; hardhat `lint` script now runs `hardhat compile` first so install→lint→build is clean.
- Submit/register URL live today: registration form only at https://hedera.com/scaffold-hbar-template-bounty/#form (First Name, Last Name, Email, marketing consent). Full submit form (repo URL + HashScan + dev-ex survey) is described in the brief but **no separate submit form URL is published yet** as of 2026-09-21.
