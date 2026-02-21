import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@typesugar/ts-plugin",
    include: ["test/**/*.test.ts"],
    globals: true,
  },
});
