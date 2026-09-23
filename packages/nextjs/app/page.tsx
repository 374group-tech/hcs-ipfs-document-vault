import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <h1>HCS-anchored IPFS document vault</h1>
      <p className="lead">
        Store document bytes on <strong>IPFS</strong> (Kubo or Pinata). Anchor schema-v1{" "}
        <code className="mono">{"{schemaVersion, cid, sha256, size, payer, memo, ts, mime?, prevCid?}"}</code>{" "}
        on a <strong>Hedera Consensus Service</strong> topic so the proof is public and tamper-evident.
        Optional non-custodial HBAR / HIP-336 pin fee. Without IPFS there is nowhere for the bytes; without
        HCS there is no on-chain proof.
      </p>

      <div className="card">
        <h2>Flow</h2>
        <div className="steps">
          <div className="step">
            <div className="n">1</div>
            <div>
              <strong>Upload</strong> — client sha256, bytes → IPFS provider (`kubo` or `pinata`) or
              precomputed CID dry-run, receive CID.
            </div>
          </div>
          <div className="step">
            <div className="n">2</div>
            <div>
              <strong>Attest</strong> — HCS topic message schema v1; show sequence + HashScan URL.
            </div>
          </div>
          <div className="step">
            <div className="n">3</div>
            <div>
              <strong>Verify</strong> — UI paste CID, or CLI{" "}
              <code className="mono">yarn verify:proof &lt;CID&gt;</code> → Mirror Node match (legacy + v1)
              + HashScan + fetch-from-IPFS.
            </div>
          </div>
        </div>
        <div className="row">
          <Link className="btn" href="/upload">
            Open upload
          </Link>
          <Link className="btn secondary" href="/verify">
            Open verify
          </Link>
        </div>
      </div>

      <div className="card">
        <h2>One-click demo</h2>
        <p className="muted">
          After faucet + <code>.env</code>: <code>yarn demo:topic</code> → <code>yarn demo:attest</code> →{" "}
          <code>yarn verify:proof &lt;CID&gt;</code> (npm:{" "}
          <code>npm run verify:proof -w @vault/nextjs -- &lt;CID&gt;</code>).
        </p>
      </div>
    </>
  );
}
