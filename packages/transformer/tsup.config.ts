import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
    init: "src/init.ts",
    doctor: "src/doctor.ts",
    create: "src/create.ts",
    "language-service": "src/language-service.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  external: ["typescript", "@typesugar/core"],
  cjsInterop: true,
  shims: true,
});
