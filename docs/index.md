---
layout: home

hero:
  name: typesugar
  text: Zero-cost typeclasses for TypeScript
  tagline: Operators and methods that just work, compiled to exactly what you'd write by hand.
  image:
    src: /logo.png
    alt: typesugar
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/
    - theme: alt
      text: View on GitHub
      link: https://github.com/dpovey/typesugar

features:
  - icon: ⚡
    title: Zero-Cost Abstractions
    details: Typeclass operations compile to direct code. No dictionaries, no wrappers, no overhead.
  - icon: 🪄
    title: Just Works™
    details: Use === and .show() on any type. Auto-derived from structure, auto-specialized at call sites.
  - icon: 🧩
    title: Extensible Macros
    details: Expression, attribute, derive, tagged template, type, and labeled block macros.
  - icon: 🦀
    title: Inspired by the Best
    details: Scala 3 typeclasses, Rust derives, Zig comptime — brought to TypeScript.
---

## Quick Example

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const alice: User = { id: 1, name: "Alice", email: "alice@example.com" };
const bob: User = { id: 2, name: "Bob", email: "bob@example.com" };

// Operators just work — auto-derived, auto-specialized
alice === bob; // Compiles to: alice.id === bob.id && alice.name === bob.name && ...
alice < bob; // Lexicographic comparison

// Methods just work too
alice.show(); // "User(id = 1, name = Alice, email = alice@example.com)"
alice.clone(); // Deep copy
alice.toJson(); // JSON serialization
```

**How it works:** The compiler sees `===` on a `User`, resolves the `Eq` typeclass, auto-derives an instance from the type's fields, and inlines the comparison directly — no dictionary lookup, no runtime cost.

## Features at a Glance

| Feature                 | Description                                        |
| ----------------------- | -------------------------------------------------- |
| **Typeclasses**         | `===`, `.show()`, `.clone()` just work on any type |
| **Auto-Specialization** | Typeclass methods inline to direct code            |
| **Compile-time Eval**   | `comptime()` runs code at build time               |
| **Tagged Templates**    | sql, regex, html with compile-time validation      |
| **Labeled Blocks**      | `let: { } yield: { }` for monadic do-notation      |
| **Type Macros**         | `Refined<T>`, `Opaque<T>`, `Phantom<S, T>`         |

## Packages

### Core

| Package                                                   | Description                    |
| --------------------------------------------------------- | ------------------------------ |
| [@typesugar/transformer](/reference/packages#transformer) | Core TypeScript transformer    |
| [@typesugar/core](/reference/packages#core)               | Macro registration and types   |
| [unplugin-typesugar](/reference/packages#unplugin)        | Vite, esbuild, Webpack plugins |

### Features

| Package                                               | Description                               |
| ----------------------------------------------------- | ----------------------------------------- |
| [@typesugar/typeclass](/reference/packages#typeclass) | Implicit typeclass resolution             |
| [@typesugar/derive](/reference/packages#derive)       | Auto-generate Eq, Ord, Clone, Debug, Json |
| [@typesugar/fp](/reference/packages#fp)               | Option, Result, IO, and HKT               |
| [@typesugar/sql](/reference/packages#sql)             | Type-safe SQL fragments                   |
| [@typesugar/contracts](/reference/packages#contracts) | Design by contract                        |

### Adapters

| Package                                           | Description                |
| ------------------------------------------------- | -------------------------- |
| [@typesugar/effect](/reference/packages#effect)   | Deep Effect-TS integration |
| [@typesugar/react](/reference/packages#react)     | React macros               |
| [@typesugar/testing](/reference/packages#testing) | Testing utilities          |

## Vision

Long-term vision documents for typesugar's future:

- [Vision Index](/vision/) — Overview, philosophy, roadmap
- [Reactivity](/vision/reactivity) — State model with type-aware auto-unwrapping
- [Effect Integration](/vision/effect-integration) — Deep Effect-TS integration
