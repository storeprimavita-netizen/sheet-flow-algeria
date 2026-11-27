import path from "node:path";

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // .worktrees/ holds full copies of the project for agents working in parallel
    // (scripts/night-workers.sh). Their tests belong to their own gate, not to this folder's.
    exclude: [...configDefaults.exclude, ".worktrees/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Next bundles server-only internally; tests run server-side anyway.
      "server-only": path.resolve(__dirname, "node_modules/next/dist/compiled/server-only/empty.js"),
    },
  },
});
