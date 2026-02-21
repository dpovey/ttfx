# typesugar

> Zero-cost typeclasses for TypeScript — operators and methods that just work, compiled to exactly what you'd write by hand.

## What is typesugar?

typesugar is a macro system for TypeScript that runs at compile time. Define your types, and typeclass operations (`===`, `.show()`, `.clone()`) work automatically — derived from type structure and specialized to direct code with zero runtime overhead.

## Quick Example

```typescript
// Define your types — no decorators needed
interface User {
  id: number;
  name: string;
  email: string;
}

const alice: User = { id: 1, name: "Alice", email: "alice@example.com" };
const bob: User = { id: 2, name: "Bob", email: "bob@example.com" };

// Operators just work — auto-derived, auto-specialized
alice === bob; // false (compiles to: alice.id === bob.id && ...)
alice < bob; // true  (lexicographic comparison)

// Methods just work too
alice.show(); // "User(id = 1, name = Alice, email = alice@example.com)"
alice.clone(); // deep copy
alice.toJson(); // JSON serialization
```

**How it works:** The compiler sees `===` on a `User`, resolves the `Eq` typeclass, auto-derives an instance from the type's fields, and inlines the comparison directly — no dictionary lookup, no runtime cost.

## Features

- **Zero-Cost Typeclasses** — `===`, `.show()`, `.clone()` just work on any type
- **Auto-Specialization** — typeclass methods inline to direct code
- **Compile-time Eval** — `comptime()` runs code at build time
- **Tagged Templates** — sql, regex, html tagged templates with validation
- **Labeled Blocks** — `let: { } yield: { }` for monadic do-notation
- **Type Macros** — `Refined<T>`, `Opaque<T>`, `Phantom<S, T>`

## Getting Started

```bash
npm install @typesugar/typesugar @typesugar/transformer
```

See the [Getting Started Guide](./getting-started.md) for detailed setup instructions.

## Packages

### Core

| Package                                             | Description                  |
| --------------------------------------------------- | ---------------------------- |
| [@typesugar/transformer](./packages/transformer)    | Core TypeScript transformer  |
| [@typesugar/core](./packages/core)                  | Macro registration and types |
| [@typesugar/typesugar](./packages/typesugar)        | Umbrella package             |
| [unplugin-typesugar](./packages/unplugin-typesugar) | Bundler plugins              |

### Typeclasses & Macros

| Package                                        | Description                         |
| ---------------------------------------------- | ----------------------------------- |
| [@typesugar/typeclass](./packages/typeclass)   | Implicit typeclass resolution       |
| [@typesugar/specialize](./packages/specialize) | Auto-specialization for zero-cost   |
| [@typesugar/derive](./packages/derive)         | Explicit derive (for documentation) |
| [@typesugar/comptime](./packages/comptime)     | Compile-time evaluation             |
| [@typesugar/reflect](./packages/reflect)       | Type reflection                     |
| [@typesugar/operators](./packages/operators)   | Custom operator mapping             |

### Domain-Specific

| Package                                          | Description                         |
| ------------------------------------------------ | ----------------------------------- |
| [@typesugar/sql](./packages/sql)                 | Type-safe SQL                       |
| [@typesugar/strings](./packages/strings)         | String validation macros            |
| [@typesugar/units](./packages/units)             | Physical units                      |
| [@typesugar/type-system](./packages/type-system) | Advanced types (HKT, Newtype, etc.) |
| [@typesugar/fp](./packages/fp)                   | Functional programming              |

### Adapters

| Package                                  | Description                                            |
| ---------------------------------------- | ------------------------------------------------------ |
| [@typesugar/effect](./packages/effect)   | Deep Effect-TS integration (@service, @layer, derives) |
| [@typesugar/kysely](./packages/kysely)   | Kysely integration                                     |
| [@typesugar/react](./packages/react)     | React macros                                           |
| [@typesugar/testing](./packages/testing) | Testing macros                                         |

## Documentation

- [Getting Started](./getting-started.md)
- [Macro Types](./macro-types.md)
- [Macro Trigger Patterns](./macro-triggers.md) — all the ways macros can be invoked
- [Writing Macros](./writing-macros.md)
- [Architecture](./architecture.md)
- [FAQ](./faq.md)

## Vision

Long-term vision documents for typesugar's future features:

- [Vision Index](./vision/index.md) — Overview, philosophy, roadmap
- [Reactivity](./vision/reactivity.md) — State model with type-aware auto-unwrapping
- [Components](./vision/components.md) — Component definitions and template system
- [Fx](./vision/fx.md) — Typed effects that compile to async/await
- [Server](./vision/server.md) — Server integration, RPC, SSR
- [Effect Integration](./vision/effect-integration.md) — Deep Effect-TS integration

## License

MIT
