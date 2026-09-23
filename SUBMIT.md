# Submission checklist (Scaffold-HBAR Template Bounty)

Repo (public):
`https://github.com/374group-tech/hcs-ipfs-document-vault`

**HEAD features:** `yarn verify:proof` · dual IPFS (`kubo` | `pinata`) · attestation **schema v1** (`schemaVersion`, optional `mime` / `prevCid`) with legacy verify · optional non-custodial HBAR pin fee.

## Official submit (live as of 2026-09-23)

1. Open https://hedera.com/scaffold-hbar-template-bounty/
2. Click **Submit your project** → Google Form (Bounty prefilled = Scaffold HBAR Template):
   https://docs.google.com/forms/d/e/1FAIpQLSfMrExu3tI95KP9WlwtS9JFka5iy3uWOi8vVK4JqpLbd0FTPA/viewform?usp=pp_url&entry.1760747509=Scaffold+HBAR+Template
3. Registration (name/email) remains at `#form` on the same page if not done yet.

**Deadline:** before **2026-10-04 23:59 ET** (= **2026-10-05 07:59 Asia/Yerevan**). AMA optional: 2026-09-29 10:00 ET.

---

## Paste-ready form blocks (founder)

Copy-paste into the Google Form. Do not invent extra products.

### Project Name

```text
HCS-anchored IPFS Document Vault
```

### Project Description (EN, short — 5–8 sentences)

```text
Scaffold-HBAR external template for an HCS-anchored IPFS document vault. Developers upload a document to IPFS (local Kubo or Pinata), then attest schema-v1 JSON {schemaVersion, cid, sha256, size, payer, memo, ts, mime?, prevCid?} on a Hedera Consensus Service topic. Verification uses Mirror Node plus HashScan, with a CLI yarn verify:proof that exits 0 on match for both schema v1 and legacy messages. IPFS and HCS are load-bearing: without IPFS there is no durable content-addressed blob; without HCS there is no public, ordered, tamper-evident proof. An optional non-custodial native HBAR / HIP-336 pin fee can be paid payer → treasury with no custodial hop. The monorepo ships packages/ledger (pure helpers), optional Hardhat PinFeeCollector, and a Next.js App Router UI (/upload, /verify). Judges can recreate via npm create scaffold-hbar@latest --template 374group-tech/hcs-ipfs-document-vault, then follow the README 5-minute path and live HashScan proofs on topic 0.0.10600873 (schema v1 seq 4, legacy seq 3).
```

### GitHub URL

```text
https://github.com/374group-tech/hcs-ipfs-document-vault
```

### Any other links

```text
HashScan schema v1 (seq 4): https://hashscan.io/testnet/topic/0.0.10600873/4
HashScan legacy (seq 3): https://hashscan.io/testnet/topic/0.0.10600873/3
HCS topic: https://hashscan.io/testnet/topic/0.0.10600873
Pin fee transfer: https://hashscan.io/testnet/transaction/0.0.10600860%401789747920.746708423
Verify one-liner: yarn verify:proof bafkreic5ywzvohvo6kbiuym2q57omcfruwgfrbekfip73h33jqjdolgdaq --topic 0.0.10600873 --sequence 4
```

### Video demo / Dev-ex survey

- Video: short screencast — upload → attest → verify (UI and/or `yarn verify:proof` on seq 4). See `docs/assets/README.md` for shot list.
- Dev-ex survey: link from the submit form / bounty page — complete when submitting (**founder**).

---

## Form fields summary

| Field | What to paste |
| --- | --- |
| Project Name | block above |
| Project Description | block above |
| GitHub URL | `https://github.com/374group-tech/hcs-ipfs-document-vault` |
| Any other links | both HashScans + topic + pin + `verify:proof` one-liner (block above) |
| Video demo | Short screencast (**founder**) |
| Dev-ex survey | From form / bounty page (**founder**) |

## Code-side checklist (done)

1. [x] GitHub repo **public** + MIT `LICENSE`
2. [x] Fresh scaffold PASS (2026-09-21): `npm create scaffold-hbar@latest --template 374group-tech/hcs-ipfs-document-vault`
3. [x] Fresh install + lint + build PASS; routes `/` `/upload` `/verify`
4. [x] HashScan proofs in README Status (schema v1 seq **4** + legacy seq **3** + pin fee)
5. [x] `yarn verify:proof` CLI + dual IPFS + schema v1 on write / legacy verify
6. [ ] Paste GitHub + HashScan + description into Google Form (**founder**)
7. [ ] Video demo (**founder**)
8. [ ] Dev-ex survey (**founder**)
9. [ ] Optional AMA 2026-09-29
10. [ ] Submit before deadline

## Do not submit

- `.env` / private keys / `PINATA_JWT`
- `node_modules`
- SaucerSwap / merchant / Bitluma / AgentBazaar / CDRAM / invoices / cloned official built-in templates

## Local gate re-check

- [x] `yarn lint` + `yarn test` + `yarn build` (re-run on polish day)
- [x] `create-scaffold-hbar@0.4.0` from local template dir PASS
- [x] Official public-repo scaffold after 21.09 (2026-09-21 PASS)
- [x] Local `create-scaffold-hbar@0.4.0` TEMPLATE_DIR smoke **PASS** (2026-09-23 Asia/Yerevan, `--skip-install`)

## CLI verify (judges / self-check)

```bash
# Schema v1 (seq 4) — expect schemaVersion=1, prevCid, match=yes
yarn verify:proof bafkreic5ywzvohvo6kbiuym2q57omcfruwgfrbekfip73h33jqjdolgdaq --topic 0.0.10600873 --sequence 4

# Legacy (seq 3) — expect schemaVersion=legacy, match=yes
yarn verify:proof bafkreif7ckqfqbizpthadxlizpgwlgujq6lv3uj26ef2bshy4n2kyd2yny --topic 0.0.10600873 --sequence 3
```

## Proof already live

IPFS is the **35-pt ecosystem integration** (decentralised storage): load-bearing — remove it and there is no durable document blob/CID. See README “Why this pattern” + Status table.

| Item | Link |
| --- | --- |
| HCS topic | https://hashscan.io/testnet/topic/0.0.10600873 |
| Schema v1 attest (seq 4) | https://hashscan.io/testnet/topic/0.0.10600873/4 |
| Legacy attest (seq 3) | https://hashscan.io/testnet/topic/0.0.10600873/3 |
| Pin fee transfer | https://hashscan.io/testnet/transaction/0.0.10600860%401789747920.746708423 |
