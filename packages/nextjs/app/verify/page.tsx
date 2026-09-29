"use client";

import { useState } from "react";

type CidCheck =
  | { status: "match" | "mismatch"; computedCid: string }
  | { status: "not-recomputable"; reason: string };

type Content =
  | {
      state: "match" | "hash-mismatch";
      source: { kind: "gateway"; url: string } | { kind: "file"; path: string };
      expectedSha256: string;
      computedSha256: string;
      expectedSize: number;
      actualSize: number;
      cid: CidCheck;
      attempts: { url: string; error: string }[];
    }
  | { state: "unavailable"; expectedSha256: string; attempts: { url: string; error: string }[] };

type Match = {
  attestation: {
    cid: string;
    sha256: string;
    size: number;
    payer: string;
    memo: string;
    ts: number;
    schemaVersion?: number;
    mime?: string;
    prevCid?: string;
  };
  payerCheck: "match" | "mismatch" | "unknown";
  topicId: string;
  sequenceNumber: number;
  consensusTimestamp: string;
  consensusTimestampIso: string;
  payerAccountId?: string;
  runningHash?: string;
  hashScanUrl: string;
  mirrorMessageUrl: string;
  ipfsGatewayUrl: string;
  raw: string;
  content?: Content;
};

type Verdict =
  | "match"
  | "hcs-only"
  | "hash-mismatch"
  | "payer-mismatch"
  | "content-unavailable"
  | "not-anchored";

type VerifyResponse = {
  topicId: string;
  cid: string | null;
  mode: "sequence" | "scan";
  matchCount: number;
  scannedCount: number;
  pages: number;
  truncated: boolean;
  matches: Match[];
  verdict: Verdict;
  exitCode: number;
  mirror?: { listUrl: string };
  hashScanTopicUrl?: string;
  mismatch?: { expectedCid: string; foundCid: string; sequenceNumber: number; hashScanUrl: string };
  error?: string;
};

const VERDICTS: Record<Verdict, { cls: string; title: string; detail: string }> = {
  match: {
    cls: "ok",
    title: "Verified: bytes match the HCS anchor",
    detail: "Downloaded bytes hash to the sha256 anchored on Hedera Consensus Service.",
  },
  "hcs-only": {
    cls: "warn",
    title: "Anchored on HCS (content not checked)",
    detail: "The attestation exists; bytes were not downloaded.",
  },
  "hash-mismatch": {
    cls: "err",
    title: "Tampered: hash mismatch",
    detail: "These bytes do NOT match the sha256 anchored on HCS.",
  },
  "payer-mismatch": {
    cls: "err",
    title: "Payer mismatch",
    detail: "The attestation's payer field differs from the account that paid for the HCS message.",
  },
  "content-unavailable": {
    cls: "warn",
    title: "Anchored, but content unavailable",
    detail: "No IPFS gateway returned the bytes in time. Retry, add IPFS_GATEWAY_FALLBACKS, or compare a local file.",
  },
  "not-anchored": {
    cls: "err",
    title: "No match",
    detail: "No vault attestation for this CID on the topic.",
  },
};

function ContentDetails({ c }: { c: Content }) {
  return (
    <>
      {c.attempts.length > 0 && (
        <div>
          <dt>Gateway attempts failed</dt>
          <dd className="mono">
            {c.attempts.map((a) => (
              <div key={a.url}>
                {a.url} — {a.error}
              </div>
            ))}
          </dd>
        </div>
      )}
      {c.state !== "unavailable" && (
        <>
          <div>
            <dt>Bytes from</dt>
            <dd className="mono">{c.source.kind === "file" ? `local file ${c.source.path}` : c.source.url}</dd>
          </div>
          <div>
            <dt>Recomputed sha256</dt>
            <dd className={`mono ${c.state === "match" ? "ok" : "err"}`}>
              {c.computedSha256} ({c.actualSize} bytes, anchored {c.expectedSize})
            </dd>
          </div>
          <div>
            <dt>CID check</dt>
            <dd className={c.cid.status === "match" ? "ok" : c.cid.status === "mismatch" ? "err" : "muted"}>
              {c.cid.status === "not-recomputable"
                ? `not recomputed: ${c.cid.reason}`
                : `${c.cid.status}: ${c.cid.computedCid}`}
            </dd>
          </div>
        </>
      )}
    </>
  );
}

export default function VerifyPage() {
  const [cid, setCid] = useState("");
  const [topicId, setTopicId] = useState("");
  const [sequence, setSequence] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [skipContent, setSkipContent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);

  async function onVerify() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      let res: Response;
      if (file) {
        const form = new FormData();
        form.set("file", file);
        if (cid.trim()) form.set("cid", cid.trim());
        if (topicId.trim()) form.set("topicId", topicId.trim());
        if (sequence.trim()) form.set("sequence", sequence.trim());
        res = await fetch("/api/hcs/verify", { method: "POST", body: form });
      } else {
        const qs = new URLSearchParams();
        if (cid.trim()) qs.set("cid", cid.trim());
        if (topicId.trim()) qs.set("topicId", topicId.trim());
        if (sequence.trim()) qs.set("sequence", sequence.trim());
        if (skipContent) qs.set("content", "skip");
        res = await fetch(`/api/hcs/verify?${qs.toString()}`);
      }
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
  const v = result ? VERDICTS[result.verdict] : null;

  return (
    <>
      <h1>Verify</h1>
      <p className="lead">
        Trustless check: find the CID&apos;s attestation on <strong>HCS</strong> via the Mirror Node, compare the
        declared payer with the account that paid, then download the bytes from <strong>IPFS</strong> gateways
        (with fallbacks) and recompute sha256 (and raw CIDs) against the anchor. Or compare a local copy of the
        file. CLI: <code>yarn verify:proof &lt;CID&gt;</code> (exit 0 match · 2 tampered · 3 unavailable).
      </p>

      <div className="card">
        <label htmlFor="cid">CID</label>
        <input
          id="cid"
          type="text"
          placeholder="bafk… / bafy… / Qm… (required unless sequence is set)"
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
        <label htmlFor="seq">Sequence (optional — direct Mirror fetch; otherwise all pages are scanned)</label>
        <input
          id="seq"
          type="text"
          placeholder="e.g. 5 — GET /topics/{id}/messages/{seq}"
          value={sequence}
          onChange={(e) => setSequence(e.target.value)}
        />
        <div style={{ height: "0.85rem" }} />
        <label htmlFor="file">Local file (optional — compare this copy instead of downloading from IPFS)</label>
        <input id="file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <div style={{ height: "0.85rem" }} />
        <label className="row" style={{ gap: "0.5rem" }}>
          <input
            type="checkbox"
            checked={skipContent}
            disabled={Boolean(file)}
            onChange={(e) => setSkipContent(e.target.checked)}
          />
          HCS only (skip content download)
        </label>
        <div style={{ height: "1rem" }} />
        <button disabled={!canSubmit || busy} onClick={onVerify}>
          {busy ? "Verifying…" : "Verify"}
        </button>
      </div>

      {error && (
        <div className="card">
          <p className="err">{error}</p>
        </div>
      )}

      {result && v && (
        <div className="card">
          <h2 className={v.cls} data-verdict={result.verdict}>
            {v.title}
          </h2>
          <p className="muted">
            {v.detail} (CLI exit code {result.exitCode})
          </p>
          <dl className="meta">
            <div>
              <dt>Topic</dt>
              <dd className="mono">{result.topicId}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>
                {result.mode === "sequence" ? "direct sequence fetch" : "scan all messages"} · scanned{" "}
                {result.scannedCount} in {result.pages} page(s){result.truncated ? " (truncated)" : ""}
              </dd>
            </div>
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
                Seq <span className="ok">{m.sequenceNumber}</span>{" "}
                <span className="pill">{m.attestation.schemaVersion ? `schema v${m.attestation.schemaVersion}` : "legacy"}</span>
              </h2>
              <dl className="meta">
                <div>
                  <dt>CID</dt>
                  <dd className="mono">{m.attestation.cid}</dd>
                </div>
                <div>
                  <dt>Consensus timestamp</dt>
                  <dd>
                    <span className="mono">{m.consensusTimestamp}</span>
                    {m.consensusTimestampIso && <span className="muted"> · {m.consensusTimestampIso}</span>}
                  </dd>
                </div>
                <div>
                  <dt>Payer (declared / Mirror)</dt>
                  <dd className={`mono ${m.payerCheck === "mismatch" ? "err" : m.payerCheck === "match" ? "ok" : ""}`}>
                    {m.attestation.payer} / {m.payerAccountId ?? "unknown"} — {m.payerCheck}
                  </dd>
                </div>
                <div>
                  <dt>Anchored sha256</dt>
                  <dd className="mono">{m.attestation.sha256}</dd>
                </div>
                <div>
                  <dt>Content</dt>
                  <dd className={m.content?.state === "match" ? "ok" : m.content?.state === "hash-mismatch" ? "err" : "muted"}>
                    {m.content ? m.content.state : "skipped"}
                  </dd>
                </div>
                {m.content && <ContentDetails c={m.content} />}
                {m.attestation.prevCid && (
                  <div>
                    <dt>prevCid</dt>
                    <dd className="mono">{m.attestation.prevCid}</dd>
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
            </div>
          ))}
        </div>
      )}
    </>
  );
}
