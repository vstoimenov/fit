import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests against the local Supabase stack (`pnpm db:start`).
export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
