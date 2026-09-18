/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@vault/ledger"],
  experimental: {
    serverComponentsExternalPackages: ["@hashgraph/sdk"],
  },
};

export default nextConfig;
