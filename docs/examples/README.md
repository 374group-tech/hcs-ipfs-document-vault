# Verify examples (testnet topic 0.0.10600873)

| File | What it is | Expected `yarn verify:proof … --sequence 5 --file <file>` |
|---|---|---|
| `agreement-seq5.txt` | The exact 61 bytes pinned as `bafkreihbeveqd5e6z7sry2zjyxqfzzjcoc6efxnj4isnb47tyt5xnedlru` and anchored on HCS seq 5 | `content=match`, `cidCheck=match`, exit **0** |
| `agreement-seq5-tampered.txt` | Same file with `Bob` → `Mallory` | `content=hash-mismatch`, exit **2** |
| `demo-seq3.txt` | `yarn demo:attest` output anchored on seq 3 (legacy schema), CID `bafkreif7ckqfqbizpthadxlizpgwlgujq6lv3uj26ef2bshy4n2kyd2yny` | `--sequence 3 --file …` → `match`, exit **0** |
| `demo-seq2.txt` | `yarn demo:attest` output anchored on seq 2 (legacy), CID `bafkreiei5zxiksg2nytbmtmdhp6tguankwmdftrc6gqwvmct632ezbgrka` | `--sequence 2 --file …` → `match`, exit **0** |

Seq 1 is an early dry-run that anchored a placeholder CID (`bafybeigdyrzt5…`, the IPFS docs example) with the sha256 of a
different file, so a gateway download of that CID correctly ends in `hash-mismatch` (exit 2). HCS-only checks
(`--skip-content`) still pass for all five messages.

Seq 2 and 3 bytes were only pinned on the author's local Kubo node, so public gateways may answer `content-unavailable`
(exit 3); the bundled files let anyone check them offline.

```bash
CID=bafkreihbeveqd5e6z7sry2zjyxqfzzjcoc6efxnj4isnb47tyt5xnedlru
yarn verify:proof $CID --topic 0.0.10600873 --sequence 5 --file docs/examples/agreement-seq5.txt           # exit 0
yarn verify:proof $CID --topic 0.0.10600873 --sequence 5 --file docs/examples/agreement-seq5-tampered.txt  # exit 2
```

Relative `--file` paths are resolved from the repo root under `yarn` (absolute paths work anywhere).
The same pair is used offline in `packages/ledger/test/content.test.ts`.
