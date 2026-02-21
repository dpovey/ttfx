import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@typesugar/geometry",
    include: ["src/__tests__/**/*.test.ts"],
  },
});
