import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@typesugar/graph",
    globals: true,
    environment: "node",
  },
});
