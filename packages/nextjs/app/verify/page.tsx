"use client";

import { useState } from "react";

type Match = {
  attestation: {
    cid: string;
    sha256: string;
    size: number;
    payer: string;
    memo: string;
    ts: number;
  };
  topicId: string;
  sequenceNumber: number;
  consensusTimestamp: string;
  consensusTimestampIso: string;
  payerAccountId?: string;
  runningHash?: string;
  hashScanUrl: string;
  hashScanTopicUrl: string;
  mirrorMessageUrl: string;
  ipfsGatewayUrl: string;
  raw: string;
};

type VerifyResponse = {
  topicId: string;
  cid: string | null;
  sequence: number | null;
  mode: "sequence" | "scan";
  matchCount: number;
  scannedCount: number;
  matches: Match[];
  mirror?: {
    baseUrl: string;
    listUrl: string;
    messageUrl: string | null;
  };
  hashScanTopicUrl?: string;
  mismatch?: {
    expectedCid: string;
    foundCid: string;
    sequenceNumber: number;
    hashScanUrl: string;
  };
  error?: string;
};

export default function VerifyPage() {
  const [cid, setCid] = useState("");
  const [topicId, setTopicId] = useState("");
  const [sequence, setSequence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);

  async function onVerify() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const qs = new URLSearchParams();
      if (cid.trim()) qs.set("cid", cid.trim());
      if (topicId.trim()) qs.set("topicId", topicId.trim());
      if (sequence.trim()) qs.set("sequence", sequence.trim());
      const res = await fetch(`/api/hcs/verify?${qs.toString()}`);
      const json = (await res.json()) as VerifyResponse;
      if (!res.ok) throw new Error(json.error || "verify failed");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = Boolean(cid.trim() || sequence.trim());

  return (
    <>
      <h1>Verify</h1>
      <p className="lead">
        Paste a CID (and optionally a sequence). The app fetches HCS messages from the{" "}
        <strong>Mirror Node</strong>, shows topic / sequence / consensus timestamp, HashScan, and a
        fetch-from-IPFS link. Accepts <strong>schema v1</strong> and <strong>legacy</strong> attestations.
        CLI: <code>yarn verify:proof &lt;CID&gt;</code> (same Mirror match; exit 0/1).
      </p>

      <div className="card">
        <label htmlFor="cid">CID</label>
        <input
          id="cid"
          type="text"
          placeholder="bafy… or Qm… (required unless sequence is set)"
          value={cid}
          onChange={(e) => setCid(e.target.value)}
        />
        <div style={{ height: "0.85rem" }} />
        <label htmlFor="topic">Topic ID (optional override)</label>
        <input
          id="topic"
          type="text"
          placeholder="0.0.x (defaults to HCS_TOPIC_ID)"
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
        />
        <div style={{ height: "0.85rem" }} />
        <label htmlFor="seq">Sequence (optional — direct Mirror fetch)</label>
        <input
          id="seq"
          type="text"
          placeholder="e.g. 3 — GET /topics/{id}/messages/{seq}"
          value={sequence}
          onChange={(e) => setSequence(e.target.value)}
        />
        <div style={{ height: "1rem" }} />
        <button disabled={!canSubmit || busy} onClick={onVerify}>
          {busy ? "Querying Mirror Node…" : "Verify on HCS"}
        </button>
      </div>

      {error && (
        <div className="card">
          <p className="err">{error}</p>
        </div>
      )}

      {result && (
        <div className="card">
          <h2>
            {result.matchCount > 0 ? (
              <span className="ok">Match ({result.matchCount})</span>
            ) : (
              <span className="err">No match</span>
            )}
          </h2>
          <dl className="meta">
            <div>
              <dt>Topic</dt>
              <dd className="mono">{result.topicId}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>
                {result.mode === "sequence" ? "direct sequence fetch" : "scan recent messages"} ·
                scanned {result.scannedCount}
              </dd>
            </div>
            {result.cid && (
              <div>
                <dt>CID queried</dt>
                <dd className="mono">{result.cid}</dd>
              </div>
            )}
          </dl>
          <div className="row" style={{ marginTop: "0.75rem" }}>
            {result.hashScanTopicUrl && (
              <a className="btn secondary" href={result.hashScanTopicUrl} target="_blank" rel="noreferrer">
                HashScan topic
              </a>
            )}
            {result.mirror?.listUrl && (
              <a className="btn secondary" href={result.mirror.listUrl} target="_blank" rel="noreferrer">
                Mirror messages JSON
              </a>
            )}
          </div>

          {result.mismatch && (
            <p className="err" style={{ marginTop: "1rem" }}>
              Sequence {result.mismatch.sequenceNumber} attests CID{" "}
              <span className="mono">{result.mismatch.foundCid}</span>, not{" "}
              <span className="mono">{result.mismatch.expectedCid}</span>.{" "}
              <a href={result.mismatch.hashScanUrl} target="_blank" rel="noreferrer">
                Open HashScan
              </a>
            </p>
          )}

          {result.matches.map((m) => (
            <div
              key={`${m.sequenceNumber}-${m.consensusTimestamp}`}
              className="card"
              style={{ marginTop: "1rem", background: "#0d1426" }}
            >
              <h2>
                Seq <span className="ok">{m.sequenceNumber}</span>
              </h2>
              <dl className="meta">
                <div>
                  <dt>Topic</dt>
                  <dd className="mono">{m.topicId}</dd>
                </div>
                <div>
                  <dt>Sequence</dt>
                  <dd className="mono">{m.sequenceNumber}</dd>
                </div>
                <div>
                  <dt>Consensus timestamp</dt>
                  <dd>
                    <span className="mono">{m.consensusTimestamp}</span>
                    {m.consensusTimestampIso && (
                      <>
                        <br />
                        <span className="muted">{m.consensusTimestampIso}</span>
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Payer (message)</dt>
                  <dd className="mono">{m.payerAccountId || m.attestation.payer}</dd>
                </div>
                <div>
                  <dt>Attestation payer</dt>
                  <dd className="mono">{m.attestation.payer}</dd>
                </div>
                <div>
                  <dt>sha256</dt>
                  <dd className="mono">{m.attestation.sha256}</dd>
                </div>
                <div>
                  <dt>size / memo</dt>
                  <dd>
                    {m.attestation.size} bytes · {m.attestation.memo || "—"}
                  </dd>
                </div>
                {m.runningHash && (
                  <div>
                    <dt>Running hash</dt>
                    <dd className="mono">{m.runningHash}</dd>
                  </div>
                )}
              </dl>
              <div className="row" style={{ marginTop: "0.85rem" }}>
                <a className="btn" href={m.hashScanUrl} target="_blank" rel="noreferrer">
                  Open HashScan
                </a>
                <a className="btn secondary" href={m.mirrorMessageUrl} target="_blank" rel="noreferrer">
                  Mirror message JSON
                </a>
                <a className="btn secondary" href={m.ipfsGatewayUrl} target="_blank" rel="noreferrer">
                  Fetch from IPFS
                </a>
              </div>
              <pre style={{ marginTop: "0.85rem" }}>{m.raw}</pre>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
