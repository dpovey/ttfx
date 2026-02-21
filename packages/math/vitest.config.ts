import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@typesugar/math",
    globals: true,
    environment: "node",
  },
});
