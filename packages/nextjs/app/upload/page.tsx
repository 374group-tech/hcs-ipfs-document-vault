"use client";

import { useMemo, useState } from "react";

type AddResponse = {
  cid: string;
  sha256: string;
  size: number;
  source: string;
  gatewayUrl: string;
  error?: string;
};

type AttestResponse = {
  topicId: string;
  sequenceNumber: string;
  transactionId: string;
  hashScanTopicUrl: string;
  hashScanTxUrl: string;
  attestation: Record<string, unknown>;
  pinFee?: Record<string, unknown>;
  error?: string;
};

async function sha256HexBrowser(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [precomputedCid, setPrecomputedCid] = useState("");
  const [memo, setMemo] = useState("vault-attest");
  const [prevCid, setPrevCid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addResult, setAddResult] = useState<AddResponse | null>(null);
  const [attestResult, setAttestResult] = useState<AttestResponse | null>(null);
  const [clientHash, setClientHash] = useState<string | null>(null);

  const canSubmit = useMemo(() => Boolean(file || precomputedCid), [file, precomputedCid]);

  async function onUploadAndAttest() {
    setBusy(true);
    setError(null);
    setAddResult(null);
    setAttestResult(null);
    try {
      let sha256 = "";
      let size = 0;
      const form = new FormData();
      if (file) {
        sha256 = await sha256HexBrowser(file);
        size = file.size;
        setClientHash(sha256);
        form.append("file", file);
      }
      if (precomputedCid) {
        form.append("precomputedCid", precomputedCid);
        if (!sha256) {
          // dry-run without bytes: require caller to have hashed offline; use placeholder empty hash only if provided via memo? force hash of cid string for demo dry-run
          sha256 = await sha256HexBrowser(new File([precomputedCid], "cid.txt"));
          setClientHash(sha256);
          form.append("sha256", sha256);
        }
      }

      const addRes = await fetch("/api/ipfs/add", { method: "POST", body: form });
      const addJson = (await addRes.json()) as AddResponse;
      if (!addRes.ok) throw new Error(addJson.error || "IPFS add failed");
      setAddResult(addJson);

      const attestRes = await fetch("/api/hcs/attest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid: addJson.cid,
          sha256: addJson.sha256 || sha256,
          size: addJson.size || size,
          memo,
          mime: file?.type || undefined,
          prevCid: prevCid.trim() || undefined,
        }),
      });
      const attestJson = (await attestRes.json()) as AttestResponse;
      if (!attestRes.ok) throw new Error(attestJson.error || "HCS attest failed");
      setAttestResult(attestJson);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Upload & attest</h1>
      <p className="lead">
        Hash locally, pin to IPFS, submit attestation JSON to your HCS topic. If{" "}
        <code>PIN_TOKEN_ID</code> is set, a HIP-336 allowance + non-custodial CryptoTransfer runs first.
      </p>

      <div className="card">
        <label htmlFor="file">Document</label>
        <input
          id="file"
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div style={{ height: "0.85rem" }} />
        <label htmlFor="cid">Or precomputed CID (dry-run without IPFS bytes)</label>
        <input
          id="cid"
          type="text"
          placeholder="bafy… or Qm…"
          value={precomputedCid}
          onChange={(e) => setPrecomputedCid(e.target.value.trim())}
        />
        <div style={{ height: "0.85rem" }} />
        <label htmlFor="memo">Memo</label>
        <input id="memo" type="text" value={memo} onChange={(e) => setMemo(e.target.value)} />
        <div style={{ height: "0.85rem" }} />
        <label htmlFor="prevCid">Previous CID (optional revision chain)</label>
        <input
          id="prevCid"
          type="text"
          placeholder="bafy… — links this attestation to a prior document CID"
          value={prevCid}
          onChange={(e) => setPrevCid(e.target.value.trim())}
        />
        <div style={{ height: "1rem" }} />
        <button disabled={!canSubmit || busy} onClick={onUploadAndAttest}>
          {busy ? "Working…" : "Upload → IPFS → HCS attest"}
        </button>
      </div>

      {clientHash && (
        <div className="card">
          <h2>Client sha256</h2>
          <p className="mono">{clientHash}</p>
        </div>
      )}

      {error && (
        <div className="card">
          <p className="err">{error}</p>
          <p className="muted">
            Tip: start Kubo (<code>ipfs daemon</code>), set <code>IPFS_PROVIDER=pinata</code> +{" "}
            <code>PINATA_JWT</code>, or pass a precomputed CID. Set <code>HEDERA_*</code> and{" "}
            <code>HCS_TOPIC_ID</code> in <code>.env</code>. After attest, verify with{" "}
            <code>yarn verify:proof &lt;CID&gt;</code>.
          </p>
        </div>
      )}

      {addResult && (
        <div className="card">
          <h2>IPFS</h2>
          <p>
            CID: <span className="mono">{addResult.cid}</span>{" "}
            <span className="pill">{addResult.source}</span>
          </p>
          <p>
            Gateway:{" "}
            <a href={addResult.gatewayUrl} target="_blank" rel="noreferrer">
              {addResult.gatewayUrl}
            </a>
          </p>
        </div>
      )}

      {attestResult && (
        <div className="card">
          <h2 className="ok">HCS attestation</h2>
          <p>
            Topic <span className="mono">{attestResult.topicId}</span> · sequence{" "}
            <strong>{attestResult.sequenceNumber}</strong>
          </p>
          <p>
            HashScan (topic message):{" "}
            <a href={attestResult.hashScanTopicUrl} target="_blank" rel="noreferrer">
              {attestResult.hashScanTopicUrl}
            </a>
          </p>
          <p>
            HashScan (tx):{" "}
            <a href={attestResult.hashScanTxUrl} target="_blank" rel="noreferrer">
              {attestResult.hashScanTxUrl}
            </a>
          </p>
          <pre>{JSON.stringify(attestResult.attestation, null, 2)}</pre>
          {attestResult.pinFee && (
            <>
              <h2>Pin fee</h2>
              <pre>{JSON.stringify(attestResult.pinFee, null, 2)}</pre>
            </>
          )}
        </div>
      )}
    </>
  );
}
