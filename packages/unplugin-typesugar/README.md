# unplugin-typesugar

> Bundler integrations for typesugar macro expansion.

## Overview

`unplugin-typesugar` provides plugins for popular bundlers to process typesugar macros during your build. Powered by [unplugin](https://github.com/unjs/unplugin) for maximum compatibility.

## Installation

```bash
npm install unplugin-typesugar
# or
pnpm add unplugin-typesugar
```

## Vite

```typescript
// vite.config.ts
import typesugar from "unplugin-typesugar/vite";

export default {
  plugins: [typesugar()],
};
```

## Webpack

```typescript
// webpack.config.js
const typesugar = require("unplugin-typesugar/webpack").default;

module.exports = {
  plugins: [typesugar()],
};
```

## esbuild

```typescript
// build.js
import esbuild from "esbuild";
import typesugar from "unplugin-typesugar/esbuild";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  plugins: [typesugar()],
  bundle: true,
  outfile: "dist/index.js",
});
```

## Rollup

```typescript
// rollup.config.js
import typesugar from "unplugin-typesugar/rollup";

export default {
  input: "src/index.ts",
  plugins: [typesugar()],
  output: {
    file: "dist/index.js",
    format: "esm",
  },
};
```

## Configuration

All plugins accept the same options:

```typescript
interface TypeMacroPluginOptions {
  /** Enable verbose logging */
  verbose?: boolean;

  /** Include/exclude patterns */
  include?: string | string[];
  exclude?: string | string[];

  /** Custom macro modules to load */
  macroModules?: string[];
}
```

### Example with Options

```typescript
// vite.config.ts
import typesugar from "unplugin-typesugar/vite";

export default {
  plugins: [
    typesugar({
      verbose: true,
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts"],
    }),
  ],
};
```

## How It Works

The integration plugins:

1. **Intercept** TypeScript files during the build
2. **Create a TypeScript program** with the typesugar transformer
3. **Expand macros** at compile time
4. **Emit transformed code** to the bundler

This means macros are fully expanded before your code reaches the bundler's optimization pipeline.

## API Reference

### Exports

- `unplugin-typesugar/vite` — Vite plugin
- `unplugin-typesugar/webpack` — Webpack plugin
- `unplugin-typesugar/esbuild` — esbuild plugin
- `unplugin-typesugar/rollup` — Rollup plugin
- `unplugin-typesugar` — Core unplugin factory

### Types

```typescript
interface TypeMacroPluginOptions {
  verbose?: boolean;
  include?: string | string[];
  exclude?: string | string[];
  macroModules?: string[];
}
```

## License

MIT
