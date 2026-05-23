import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/core/src/__tests__/**/*.test.ts"],
    exclude: ["packages/core/src/__tests__/e2e.test.ts"],
    environment: "node",
  },
});
