import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <h1>HCS-anchored IPFS document vault</h1>
      <p className="lead">
        Store document bytes on <strong>IPFS</strong>. Anchor the CID, sha256, size, and payer on a{" "}
        <strong>Hedera Consensus Service</strong> topic so the proof is public and tamper-evident.
        Optional HIP-336 pin fee (non-custodial). Without IPFS there is nowhere for the bytes; without
        HCS there is no on-chain proof.
      </p>

      <div className="card">
        <h2>Flow</h2>
        <div className="steps">
          <div className="step">
            <div className="n">1</div>
            <div>
              <strong>Upload</strong> — client sha256, bytes → IPFS (local Kubo or documented public add),
              receive CID.
            </div>
          </div>
          <div className="step">
            <div className="n">2</div>
            <div>
              <strong>Attest</strong> — HCS topic message{" "}
              <code className="mono">{"{cid, sha256, size, payer, memo, ts}"}</code>; show sequence +
              HashScan URL.
            </div>
          </div>
          <div className="step">
            <div className="n">3</div>
            <div>
              <strong>Verify</strong> — paste CID (optional sequence), Mirror Node fetch, topic/seq/consensus
              timestamp + HashScan + fetch-from-IPFS.
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
          After faucet + <code>.env</code>: <code>yarn demo:topic</code> then{" "}
          <code>yarn demo:attest</code> (npm: <code>npm run demo:attest -w @vault/nextjs</code>).
        </p>
      </div>
    </>
  );
}
