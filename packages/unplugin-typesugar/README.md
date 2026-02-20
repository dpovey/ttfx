# unplugin-ttfx

> Bundler integrations for ttfx macro expansion.

## Overview

`unplugin-ttfx` provides plugins for popular bundlers to process ttfx macros during your build. Powered by [unplugin](https://github.com/unjs/unplugin) for maximum compatibility.

## Installation

```bash
npm install unplugin-ttfx
# or
pnpm add unplugin-ttfx
```

## Vite

```typescript
// vite.config.ts
import ttfx from "unplugin-ttfx/vite";

export default {
  plugins: [ttfx()],
};
```

## Webpack

```typescript
// webpack.config.js
const ttfx = require("unplugin-ttfx/webpack").default;

module.exports = {
  plugins: [ttfx()],
};
```

## esbuild

```typescript
// build.js
import esbuild from "esbuild";
import ttfx from "unplugin-ttfx/esbuild";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  plugins: [ttfx()],
  bundle: true,
  outfile: "dist/index.js",
});
```

## Rollup

```typescript
// rollup.config.js
import ttfx from "unplugin-ttfx/rollup";

export default {
  input: "src/index.ts",
  plugins: [ttfx()],
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
import ttfx from "unplugin-ttfx/vite";

export default {
  plugins: [
    ttfx({
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
2. **Create a TypeScript program** with the ttfx transformer
3. **Expand macros** at compile time
4. **Emit transformed code** to the bundler

This means macros are fully expanded before your code reaches the bundler's optimization pipeline.

## API Reference

### Exports

- `unplugin-ttfx/vite` — Vite plugin
- `unplugin-ttfx/webpack` — Webpack plugin
- `unplugin-ttfx/esbuild` — esbuild plugin
- `unplugin-ttfx/rollup` — Rollup plugin
- `unplugin-ttfx` — Core unplugin factory

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
