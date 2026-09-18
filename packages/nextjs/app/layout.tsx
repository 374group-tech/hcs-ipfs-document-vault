import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "HCS-IPFS Document Vault",
  description: "Upload to IPFS, attest on Hedera Consensus Service, verify via Mirror Node",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link className="brand" href="/">
            Vault<span>·HCS</span>
          </Link>
          <Link href="/upload">Upload</Link>
          <Link href="/verify">Verify</Link>
          <span className="pill">IPFS + Hedera Consensus Service</span>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
