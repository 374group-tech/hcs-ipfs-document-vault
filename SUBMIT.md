# Submission checklist (Scaffold-HBAR Template Bounty)

Repo (public):
`https://github.com/374group-tech/hcs-ipfs-document-vault`

**HEAD features:** trustless `yarn verify:proof` (IPFS download → sha256 + raw-CID recompute vs HCS anchor; match / tampered / unavailable exit codes) · Mirror payer check + `links.next` paging · optional HCS submit key · CI · dual IPFS (`kubo` | `pinata`) · attestation **schema v1** (`schemaVersion`, optional `mime` / `prevCid`) with legacy verify · optional non-custodial HBAR pin fee.

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

### Project Description (form limit: **3 sentences max**)

```text
A create-scaffold-hbar template (npm create scaffold-hbar@latest -- vault-app --template 374group-tech/hcs-ipfs-document-vault) for an HCS-anchored document vault: a Next.js app and CLI upload a file to IPFS (local Kubo or Pinata), then write a JSON attestation (schema v1: cid, sha256, size, payer, memo, ts, optional mime and prevCid for a revision chain) to a Hedera Consensus Service topic. It uses Hedera Consensus Service (topic create + message submit) for a public, ordered, tamper-evident timestamp of each document, the Mirror Node REST API plus HashScan links to verify it. Verification is trustless: the /verify page and the yarn verify:proof CLI download the bytes from IPFS gateways (timeouts + fallbacks), recompute sha256 and, for raw CIDs, the CID itself with multiformats, compare them to the HCS anchor, and check the declared payer against Mirror's payer_account_id. Distinct results for match, tampered (exit 2) and content unavailable (exit 3). Topics can be gated with an optional HCS submit key, and an optional non-custodial pin fee paid payer-to-treasury in native HBAR or an HTS token via a HIP-336 allowance. IPFS holds the bytes and HCS holds the proof, so neither can be removed: live testnet proof is topic 0.0.10600873 (sequences 3, 4 and 5).
```

### GitHub URL

```text
https://github.com/374group-tech/hcs-ipfs-document-vault
```

### Any other links

```text
Demo video: <YouTube Unlisted link>
Install: npm create scaffold-hbar@latest -- vault-app --template 374group-tech/hcs-ipfs-document-vault
CI: https://github.com/374group-tech/hcs-ipfs-document-vault/actions/workflows/ci.yml
HCS topic (testnet): https://hashscan.io/testnet/topic/0.0.10600873
All topic messages: https://hashscan.io/testnet/topic/0.0.10600873/messages
Seq 5 (schema v1, prevCid -> seq 4, recorded in the demo video): https://hashscan.io/testnet/transaction/1790452500.354841883
Seq 4 (schema v1, prevCid -> seq 3): https://hashscan.io/testnet/transaction/1790146037.223851181
Seq 3 (legacy format): https://hashscan.io/testnet/transaction/1789747927.579637159
Mirror Node (seq 5 raw): https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.10600873/messages/5
HBAR pin fee transfer (100000 tinybar payer -> treasury 0.0.10604200): https://hashscan.io/testnet/transaction/0.0.10600860%401789747920.746708423
CLI check: yarn verify:proof bafkreihbeveqd5e6z7sry2zjyxqfzzjcoc6efxnj4isnb47tyt5xnedlru --topic 0.0.10600873 --sequence 5
Tamper check (exit 2): add --file docs/examples/agreement-seq5-tampered.txt
Submit-key topic (testnet): https://hashscan.io/testnet/topic/0.0.10775303
```

### Video demo / Developer Experience

- Video demo (required, < 5 min): YouTube Unlisted link to the 3:29 screencast (upload → attest seq 5 → HashScan → verify UI + `yarn verify:proof`) (**founder**).
- Developer Experience is **not** a separate survey: it is the last section of the same Google Form (five required 1–10 ratings + three optional text questions) (**founder**).

---

## Form fields summary (live form, read 2026-09-27)

| Section | Field | What to paste |
| --- | --- | --- |
| Bounty | Bounty | `Scaffold HBAR Template` (prefilled by link) |
| Team Details | Team Size / Names / Emails / X handles (optional) | **founder** |
| Team Details | Mainnet Account ID (prize payout) | **founder** — mainnet `0.0.x`, not the testnet operator |
| Submission Details | Project Name | block above |
| Submission Details | Project Description (3 sentences max) | block above |
| Submission Details | Project GitHub URL | `https://github.com/374group-tech/hcs-ipfs-document-vault` |
| Submission Details | Video demo (< 5 min) | YouTube link (**founder**) |
| Submission Details | Any other links (optional) | block above |
| Developer Experience | 5 ratings (1–10) + 3 optional texts | **founder** |

## Code-side checklist (done)

1. [x] GitHub repo **public** + MIT `LICENSE`
2. [x] Fresh scaffold PASS with create-scaffold-hbar 0.4.1 (2026-09-29): `npm create scaffold-hbar@latest -- vault-app --template 374group-tech/hcs-ipfs-document-vault` (+ CI `scaffold-smoke` job)
3. [x] Fresh install + lint + build PASS; routes `/` `/upload` `/verify`
4. [x] HashScan proofs in README Status (schema v1 seq **5** + **4** + legacy seq **3** + pin fee)
5. [x] Trustless `yarn verify:proof` + `/verify` (sha256 + raw CID recompute, payer check, paging) + dual IPFS + schema v1 on write / legacy verify
5a. [x] GitHub Actions CI + README badge; screenshots in `docs/screenshots/`
6. [ ] Paste GitHub + HashScan + description into Google Form (**founder**)
7. [ ] Video demo (**founder**)
8. [ ] Developer Experience section of the same Google Form (**founder**)
9. [ ] Optional AMA 2026-09-29
10. [ ] Submit before deadline

## Do not submit

- `.env` / private keys / `PINATA_JWT`
- `node_modules`
- SaucerSwap / merchant / Bitluma / AgentBazaar / CDRAM / invoices / cloned official built-in templates

## Local gate re-check

- [x] `yarn lint` + `yarn test` + `yarn build` (re-run on polish day)
- [x] `create-scaffold-hbar@0.4.1` from GitHub template and local template dir PASS (2026-09-29 Asia/Yerevan)
- [x] Official public-repo scaffold after 21.09 (2026-09-21 PASS)

## CLI verify (judges / self-check)

```bash
# Schema v1 (seq 5, demo video): download from IPFS gateways, recompute sha256 + raw CID
#   expect verdict=match (exit 0), or content-unavailable (exit 3) if every gateway rate-limits you
yarn verify:proof bafkreihbeveqd5e6z7sry2zjyxqfzzjcoc6efxnj4isnb47tyt5xnedlru --topic 0.0.10600873 --sequence 5

# Same anchor, bundled copies (offline, deterministic): original → match (0), tampered → hash-mismatch (2)
yarn verify:proof bafkreihbeveqd5e6z7sry2zjyxqfzzjcoc6efxnj4isnb47tyt5xnedlru --topic 0.0.10600873 --sequence 5 --file docs/examples/agreement-seq5.txt
yarn verify:proof bafkreihbeveqd5e6z7sry2zjyxqfzzjcoc6efxnj4isnb47tyt5xnedlru --topic 0.0.10600873 --sequence 5 --file docs/examples/agreement-seq5-tampered.txt

# Schema v1 (seq 4): expect schemaVersion=1, prevCid set, payerCheck=match
yarn verify:proof bafkreic5ywzvohvo6kbiuym2q57omcfruwgfrbekfip73h33jqjdolgdaq --topic 0.0.10600873 --sequence 4

# Legacy (seq 3): expect schemaVersion=legacy, verdict=match with the bundled bytes
yarn verify:proof bafkreif7ckqfqbizpthadxlizpgwlgujq6lv3uj26ef2bshy4n2kyd2yny --topic 0.0.10600873 --sequence 3 --file docs/examples/demo-seq3.txt
```

## Proof already live

IPFS is the **35-pt ecosystem integration** (decentralised storage): load-bearing — remove it and there is no durable document blob/CID. See README “Why this pattern” + Status table.

| Item | Link |
| --- | --- |
| HCS topic | https://hashscan.io/testnet/topic/0.0.10600873 |
| All topic messages | https://hashscan.io/testnet/topic/0.0.10600873/messages |
| Schema v1 attest (seq 5, demo video) | https://hashscan.io/testnet/transaction/1790452500.354841883 |
| Schema v1 attest (seq 4) | https://hashscan.io/testnet/transaction/1790146037.223851181 |
| Legacy attest (seq 3) | https://hashscan.io/testnet/transaction/1789747927.579637159 |
| Pin fee transfer | https://hashscan.io/testnet/transaction/0.0.10600860%401789747920.746708423 |
