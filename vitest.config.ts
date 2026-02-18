import { defineConfig } from "vitest/config";
import typemacro from "@ttfx/integrations/vite";

export default defineConfig({
  plugins: [typemacro()],
  test: {
    // Run tests sequentially for more predictable output
    pool: "forks",

    // Test file patterns
    include: ["tests/**/*.test.ts"],

    // Exclude patterns
    exclude: ["node_modules", "dist"],

    // TypeScript configuration
    typecheck: {
      enabled: false, // Separate type checking from test running
    },

    // Reporter configuration
    reporters: ["verbose"],

    // Coverage configuration (optional)
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/**/*.test.ts"],
    },

    // Timeout for individual tests (ms) — generous to avoid flakiness on CI
    testTimeout: 30000,

    // Hooks timeout (ms)
    hookTimeout: 15000,
  },
});
