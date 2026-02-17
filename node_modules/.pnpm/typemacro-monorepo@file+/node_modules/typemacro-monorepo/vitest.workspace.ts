import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  // Root-level tests (legacy, will be migrated)
  {
    test: {
      name: "legacy",
      include: ["tests/**/*.test.ts"],
      globals: true,
    },
  },
  // Package tests
  "packages/*/vitest.config.ts",
]);
