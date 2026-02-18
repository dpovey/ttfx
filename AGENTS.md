# Agent Guidelines for ttfx

## Core Principles

### 1. Zero-Cost Abstractions

**This is the most important principle of ttfx.**

Every abstraction should compile away to what you'd write by hand:

- No runtime dictionary lookups — inline method bodies directly
- No wrapper types — HKT encoding exists only in types, not at runtime
- No closure allocation — flatten nested callbacks
- No indirection — generic code compiles to direct calls

Before implementing any feature, ask: "Can this be done at compile time instead of runtime?"

Use the existing `inlineMethod()` from `specialize.ts` when you need to inline function bodies.

### 2. Reuse Core Infrastructure

Before creating new utilities, check what already exists:

| Need                      | Use                                                                     |
| ------------------------- | ----------------------------------------------------------------------- |
| Inline method bodies      | `inlineMethod()` from `specialize.ts`                                   |
| Track typeclass instances | `instanceRegistry` from `typeclass.ts`                                  |
| Register macros           | `defineExpressionMacro`, `defineAttributeMacro` from `core/registry.ts` |
| Parse/create AST          | `ctx.factory`, `ctx.parseExpression()`, `ctx.parseStatements()`         |
| Get type info             | `ctx.typeChecker.getTypeAtLocation()`                                   |
| Check type properties     | `type.getProperty()`, `type.flags`                                      |

The `specialize` macro is the gold standard for zero-cost — study it before implementing new transformations.

### 3. Compile-Time Over Runtime

| Prefer                | Over                           |
| --------------------- | ------------------------------ |
| `inlineMethod()`      | Runtime function calls         |
| Direct AST generation | String concatenation + parsing |
| Type checker queries  | Runtime type checks            |
| Compile-time errors   | Runtime throws                 |

## Architecture

```
src/
├── core/           # Macro infrastructure (registry, types)
├── macros/         # Built-in macros (typeclass, specialize, operators, etc.)
├── transforms/     # TypeScript transformer
└── index.ts        # Main exports

packages/
├── core/           # @ttfx/core - macro registration
├── transformer/    # @ttfx/transformer - TS transformer plugin
├── operators/      # @ttfx/operators - operator overloading
├── typeclass/      # @ttfx/typeclass - Scala 3-style typeclasses
└── ...             # Other packages
```

## When Adding Features

1. **Check PHILOSOPHY.md** for design principles
2. **Check existing macros** in `src/macros/` for patterns
3. **Reuse `specialize.ts`** infrastructure for inlining
4. **Add tests** in `tests/` directory
5. **Update docs** if user-facing

## GitHub Account

Use `dpovey` (personal account) for this repo.
