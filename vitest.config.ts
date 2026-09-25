import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "e2e/**", "scripts/pwa-service-worker.test.mjs"],
  },
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./test-utils/server-only.ts", import.meta.url)),
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
