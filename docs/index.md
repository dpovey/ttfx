# typesugar

> Type-safe macros for TypeScript — compile-time metaprogramming without the footguns.

## What is typesugar?

typesugar is a macro system for TypeScript that runs at compile time. Write expressive, high-level code that expands to efficient, type-safe JavaScript. No runtime overhead, no magic strings, no loss of type safety.

## Quick Example

```typescript
import { comptime } from "@typesugar/comptime";
import { derive } from "@typesugar/derive";
import { sql } from "@typesugar/sql";

// Compile-time evaluation
const buildTime = comptime(new Date().toISOString());

// Auto-generated implementations
@derive(Eq, Clone, Debug, Json)
class User {
  constructor(
    public id: number,
    public name: string,
  ) {}
}

// Type-safe SQL with compile-time validation
const query = sql`SELECT * FROM users WHERE id = ${userId}`;
```

## Features

- **Expression Macros** — `comptime()`, `typeInfo<T>()`, `summon<T>()`
- **Attribute Macros** — `@derive()`, `@reflect`, `@operators()`
- **Tagged Templates** — `sql\`\``, `regex\`\``, `html\`\``
- **Labeled Blocks** — `let: { } yield: { }`
- **Type Macros** — `Refined<T>`, `Opaque<T>`, `Phantom<S, T>`

## Getting Started

```bash
npm install @typesugar/typesugar @typesugar/transformer
```

See the [Getting Started Guide](./getting-started.md) for detailed setup instructions.

## Packages

### Core

| Package                                     | Description                  |
| ------------------------------------------- | ---------------------------- |
| [@typesugar/transformer](./packages/transformer) | Core TypeScript transformer  |
| [@typesugar/core](./packages/core)               | Macro registration and types |
| [@typesugar/typesugar](./packages/typesugar)               | Umbrella package             |
| [unplugin-typesugar](./packages/unplugin-typesugar)   | Bundler plugins              |

### Macros

| Package                                   | Description                 |
| ----------------------------------------- | --------------------------- |
| [@typesugar/comptime](./packages/comptime)     | Compile-time evaluation     |
| [@typesugar/derive](./packages/derive)         | Auto-derive implementations |
| [@typesugar/reflect](./packages/reflect)       | Type reflection             |
| [@typesugar/operators](./packages/operators)   | Operator overloading        |
| [@typesugar/typeclass](./packages/typeclass)   | Scala-style typeclasses     |
| [@typesugar/specialize](./packages/specialize) | Zero-cost specialization    |

### Domain-Specific

| Package                                     | Description                         |
| ------------------------------------------- | ----------------------------------- |
| [@typesugar/sql](./packages/sql)                 | Type-safe SQL                       |
| [@typesugar/strings](./packages/strings)         | String validation macros            |
| [@typesugar/units](./packages/units)             | Physical units                      |
| [@typesugar/type-system](./packages/type-system) | Advanced types (HKT, Newtype, etc.) |
| [@typesugar/fp](./packages/fp)                   | Functional programming              |

### Adapters

| Package                             | Description           |
| ----------------------------------- | --------------------- |
| [@typesugar/effect](./packages/effect)   | Effect-TS integration |
| [@typesugar/kysely](./packages/kysely)   | Kysely integration    |
| [@typesugar/react](./packages/react)     | React macros          |
| [@typesugar/testing](./packages/testing) | Testing macros        |

## Documentation

- [Getting Started](./getting-started.md)
- [Macro Types](./macro-types.md)
- [Macro Trigger Patterns](./macro-triggers.md) — all the ways macros can be invoked
- [Writing Macros](./writing-macros.md)
- [Architecture](./architecture.md)
- [FAQ](./faq.md)

## License

MIT
