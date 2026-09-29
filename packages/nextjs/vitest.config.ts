import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Test against ledger sources so `yarn test` does not depend on a prior ledger build.
      "@vault/ledger": path.resolve(__dirname, "../ledger/src/index.ts"),
    },
  },
});
