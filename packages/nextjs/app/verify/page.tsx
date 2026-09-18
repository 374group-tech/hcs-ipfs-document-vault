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
  sequenceNumber: number;
  consensusTimestamp: string;
  hashScanUrl: string;
  ipfsGatewayUrl: string;
  raw: string;
};

type VerifyResponse = {
  topicId: string;
  cid: string;
  matchCount: number;
  matches: Match[];
  error?: string;
};

export default function VerifyPage() {
  const [cid, setCid] = useState("");
  const [topicId, setTopicId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);

  async function onVerify() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const qs = new URLSearchParams({ cid: cid.trim() });
      if (topicId.trim()) qs.set("topicId", topicId.trim());
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

  return (
    <>
      <h1>Verify</h1>
      <p className="lead">
        Paste a CID. The app reads the HCS topic via Mirror Node, shows matching attestation messages,
        HashScan links, and a fetch-from-IPFS button.
      </p>

      <div className="card">
        <label htmlFor="cid">CID</label>
        <input
          id="cid"
          type="text"
          placeholder="bafy… or Qm…"
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
        <div style={{ height: "1rem" }} />
        <button disabled={!cid.trim() || busy} onClick={onVerify}>
          {busy ? "Scanning Mirror Node…" : "Verify on HCS"}
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
          <p className="muted">
            Topic <span className="mono">{result.topicId}</span>
          </p>
          {result.matches.map((m) => (
            <div key={`${m.sequenceNumber}-${m.consensusTimestamp}`} style={{ marginTop: "1rem" }}>
              <p>
                Sequence <strong>{m.sequenceNumber}</strong> · {m.consensusTimestamp}
              </p>
              <p>
                Payer <span className="mono">{m.attestation.payer}</span> · sha256{" "}
                <span className="mono">{m.attestation.sha256}</span>
              </p>
              <div className="row">
                <a className="btn" href={m.hashScanUrl} target="_blank" rel="noreferrer">
                  Open HashScan
                </a>
                <a className="btn secondary" href={m.ipfsGatewayUrl} target="_blank" rel="noreferrer">
                  Fetch from IPFS
                </a>
              </div>
              <pre>{m.raw}</pre>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
