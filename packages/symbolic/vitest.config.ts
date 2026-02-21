import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@typesugar/symbolic",
    globals: true,
    environment: "node",
  },
});
