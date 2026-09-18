# Submission checklist (Scaffold-HBAR Template Bounty)

Repo (keep **private until 2026-09-21**, then public):
`https://github.com/374group-tech/hcs-ipfs-document-vault`

## Before submit (after 21.09.2026)

1. [ ] Make the GitHub repo **public**
2. [ ] Confirm MIT `LICENSE` is present
3. [ ] Re-run fresh scaffold:
   ```bash
   npm create scaffold-hbar@latest --template 374group-tech/hcs-ipfs-document-vault
   ```
4. [ ] From a fresh scaffold: install, lint, build, boot `/` `/upload` `/verify`
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
- [ ] Official public-repo scaffold after 21.09: `npm create scaffold-hbar@latest --template 374group-tech/hcs-ipfs-document-vault`

## Proof already live

| Item | Link |
| --- | --- |
| HCS topic | https://hashscan.io/testnet/topic/0.0.10600873 |
| IPFS+HCS+pin attest | https://hashscan.io/testnet/topic/0.0.10600873/3 |
| Pin fee transfer | https://hashscan.io/testnet/transaction/0.0.10600860%401789747920.746708423 |
