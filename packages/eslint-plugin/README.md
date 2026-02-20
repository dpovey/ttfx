# @typesugar/eslint-plugin

ESLint plugin for the typesugar macro system. This plugin enables ESLint to properly lint TypeScript files that use typesugar macros by transforming the code before linting.

## The Problem

typesugar provides compile-time macros that generate code:

```typescript
@derive(Eq, Show, Clone) // ESLint: "Eq is not defined"
class Point {
  constructor(
    public x: number,
    public y: number,
  ) {}
}

function divide(a: number, b: number) {
  requires: {
    b !== 0;
  } // ESLint: "Unused label 'requires'"
  ensures: {
    result >= 0;
  } // ESLint: "Unused label 'ensures'"
  return a / b;
}
```

Without this plugin, ESLint reports false positives because it doesn't understand that these macros are expanded at compile-time.

## The Solution

This plugin provides two processors that transform typesugar macro syntax before ESLint lints the code:

1. **Lightweight processor** (`recommended` config) - Fast, pattern-based transformation that comments out macro syntax. Good for quick feedback during development.

2. **Full processor** (`full` config) - Runs the actual `@typesugar/transformer` to fully expand macros. Slower but produces accurate expanded code.

## Installation

```bash
pnpm add -D @typesugar/eslint-plugin @typescript-eslint/parser
```

## Usage (ESLint Flat Config)

Create `eslint.config.mjs`:

```javascript
import typesugarPlugin from "@typesugar/eslint-plugin";
import tseslint from "typescript-eslint";

export default [
  // Basic TypeScript linting
  ...tseslint.configs.recommended,

  // Option 1: Lightweight (fast, pattern-based)
  typesugarPlugin.configs.recommended,

  // Option 2: Full transformation (slower, more accurate)
  // typesugarPlugin.configs.full,

  // Your custom rules
  {
    files: ["**/*.ts"],
    rules: {
      // ...
    },
  },
];
```

## How It Works

### Lightweight Processor

The lightweight processor uses regex patterns to identify and comment out macro syntax:

- `@derive(...)`, `@instance(...)`, `@typeclass(...)` decorators → commented out
- `requires:`, `ensures:` labeled blocks → commented out
- `@contract`, `@invariant` decorators → commented out

This is fast but doesn't expand the actual generated code.

### Full Processor

The full processor creates a virtual TypeScript program and runs the actual `@typesugar/transformer`:

1. Loads `@typesugar/transformer` dynamically
2. Creates an in-memory TypeScript program with the source file
3. Applies the macro transformation
4. Returns the expanded code to ESLint
5. Maps any lint errors back to original source locations

This produces the actual expanded code that the TypeScript compiler would see.

## Supported Macro Syntax

Both processors handle:

- **Typeclass decorators**: `@typeclass`, `@instance`, `@derive`, `@deriving`
- **Contract decorators**: `@contract`, `@invariant`, `@operators`
- **Labeled blocks**: `requires:`, `ensures:`, `comptime:`
- **Tagged templates**: `sql\`...\``, `regex\`...\``
- **Type reflection**: `typeInfo<T>()`, `reflect<T>()`
- **Compile-time evaluation**: `comptime(() => ...)`
- **Operator overloading**: `ops(() => a + b)`

## Configs

| Config        | Processor        | Speed | Accuracy                     |
| ------------- | ---------------- | ----- | ---------------------------- |
| `recommended` | Lightweight      | Fast  | Good (pattern-based)         |
| `full`        | Full transformer | Slow  | Excellent (actual expansion) |
| `strict`      | Lightweight      | Fast  | Good (stricter rules)        |

## API

### `clearTransformCache()`

Clears the full processor's transformation cache. Useful when files change:

```javascript
import { clearTransformCache } from "@typesugar/eslint-plugin";

// In a watch mode callback
clearTransformCache();
```

## Development

```bash
# Build the plugin
cd packages/eslint-plugin
pnpm build

# Type check
pnpm typecheck

# Watch mode
pnpm build:watch
```

## License

MIT
