# typesugar

**TypeScript that F\*cks! Compile-time macros. Zero runtime. Full type safety.**

> _What if `===` just knew how to compare your types? What if `.show()` worked on any struct? What if it all compiled to exactly what you'd write by hand?_

typesugar brings compile-time metaprogramming to TypeScript, drawing from the best ideas in Rust, Scala 3, and Zig — and making them feel native to the TypeScript ecosystem.

```typescript
// Define your types — no decorators needed
interface User {
  id: number;
  name: string;
  email: string;
}

const alice: User = { id: 1, name: "Alice", email: "alice@example.com" };
const bob: User = { id: 2, name: "Bob", email: "bob@example.com" };

// Operators just work — auto-derived, auto-specialized to zero-cost
alice === bob; // false (compiles to: alice.id === bob.id && ...)
alice < bob; // true  (lexicographic field comparison)

// Methods just work too
alice.show(); // "User(id = 1, name = Alice, email = alice@example.com)"
alice.clone(); // deep copy
alice.toJson(); // JSON serialization

// All compile to direct code — no runtime dictionary, no overhead
```

## Why typesugar?

| Feature                  | typesugar                              | ts-macros               | Babel macros |
| ------------------------ | -------------------------------------- | ----------------------- | ------------ |
| **Implicit typeclasses** | `===`, `.show()` just work             | No                      | No           |
| **Zero-cost**            | Auto-specialized to direct code        | No                      | No           |
| **Type-aware**           | Yes — reads the type checker           | No                      | No           |
| **Compile-time eval**    | Full JS via `vm` sandbox               | `$comptime` (similar)   | No           |
| **Tagged templates**     | First-class macro category             | Via expression macros   | No           |
| **Reflection**           | `typeInfo<T>()`, `validator<T>()`      | No                      | No           |
| **Operator overloading** | `+`, `*`, etc. via typeclass instances | No                      | No           |
| **Safety**               | Sandboxed, timeout, loud failures      | `$raw` runs unsandboxed | N/A          |

## Packages

### Core

| Package                                        | Description                  |
| ---------------------------------------------- | ---------------------------- |
| [typesugar](packages/typesugar)                | Umbrella package             |
| [@typesugar/transformer](packages/transformer) | Core TypeScript transformer  |
| [@typesugar/core](packages/core)               | Macro registration and types |
| [@typesugar/comptime](packages/comptime)       | Compile-time evaluation      |
| [@typesugar/derive](packages/derive)           | Auto-derive implementations  |
| [@typesugar/reflect](packages/reflect)         | Type reflection              |
| [@typesugar/operators](packages/operators)     | Operator overloading         |

### Typeclasses & FP

| Package                                      | Description                         |
| -------------------------------------------- | ----------------------------------- |
| [@typesugar/typeclass](packages/typeclass)   | Scala 3-style typeclasses           |
| [@typesugar/specialize](packages/specialize) | Zero-cost specialization            |
| [@typesugar/fp](packages/fp)                 | Functional programming library      |
| [@typesugar/std](packages/std)               | Standard typeclasses and extensions |

### Contracts

| Package                                                    | Description               |
| ---------------------------------------------------------- | ------------------------- |
| [@typesugar/contracts](packages/contracts)                 | Design by contract        |
| [@typesugar/contracts-refined](packages/contracts-refined) | Refinement types          |
| [@typesugar/contracts-z3](packages/contracts-z3)           | Z3 SMT solver integration |

### Domain-Specific

| Package                                        | Description                         |
| ---------------------------------------------- | ----------------------------------- |
| [@typesugar/sql](packages/sql)                 | Type-safe SQL                       |
| [@typesugar/react](packages/react)             | React macros                        |
| [@typesugar/strings](packages/strings)         | String validation macros            |
| [@typesugar/units](packages/units)             | Physical units                      |
| [@typesugar/type-system](packages/type-system) | Advanced types (HKT, Newtype, etc.) |

### Integrations

| Package                              | Description                                                           |
| ------------------------------------ | --------------------------------------------------------------------- |
| [@typesugar/effect](packages/effect) | Effect-TS integration (`@service`, `@layer`, `resolveLayer`, derives) |
| [@typesugar/kysely](packages/kysely) | Kysely integration                                                    |

### Tooling

| Package                                            | Description                                      |
| -------------------------------------------------- | ------------------------------------------------ |
| [unplugin-typesugar](packages/unplugin-typesugar)  | Bundler plugins (Vite, Webpack, esbuild, Rollup) |
| [@typesugar/eslint-plugin](packages/eslint-plugin) | ESLint plugin                                    |
| [@typesugar/vscode](packages/vscode)               | VSCode/Cursor extension                          |
| [@typesugar/testing](packages/testing)             | Testing macros                                   |

## Getting Started

```bash
npm install @typesugar/typesugar @typesugar/transformer
```

### Vite

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import typesugar from "unplugin-typesugar/vite";

export default defineConfig({
  plugins: [typesugar()],
});
```

### ts-patch (for tsc)

```bash
npm install -D ts-patch
npx ts-patch install
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "plugins": [{ "transform": "@typesugar/transformer" }]
  }
}
```

## Features

### Compile-Time Evaluation

```typescript
import { comptime } from "@typesugar/comptime";

const fib10 = comptime(() => {
  const fib = (n: number): number => (n <= 1 ? n : fib(n - 1) + fib(n - 2));
  return fib(10);
}); // Compiles to: const fib10 = 55;
```

### Zero-Cost Typeclasses

Typeclasses are auto-derived from type structure and auto-specialized to eliminate overhead:

```typescript
interface Point { x: number; y: number }

const p1: Point = { x: 1, y: 2 };
const p2: Point = { x: 1, y: 2 };

// Just use them — the compiler handles derivation + specialization
p1 === p2;    // Compiles to: p1.x === p2.x && p1.y === p2.y
p1.show();    // Compiles to: `Point(x = ${p1.x}, y = ${p1.y})`
p1.clone();   // Compiles to: { x: p1.x, y: p1.y }

// Optional: @derive documents capabilities in the type definition
@derive(Show, Eq, Ord, Clone, Json)
interface User { id: number; name: string; }
```

### Type Reflection

```typescript
import { typeInfo, fieldNames, validator } from "@typesugar/reflect";

const fields = fieldNames<User>(); // ["id", "name", "email"]
const validate = validator<User>(); // Runtime validator from types
```

### Tagged Templates

```typescript
import { sql } from "@typesugar/sql";
import { regex, html, json } from "@typesugar/strings";
import { units } from "@typesugar/units";

const query = sql`SELECT * FROM ${table} WHERE id = ${id}`;
const pattern = regex`^[a-zA-Z]+$`; // Validated at compile time
const markup = html`<div>${userInput}</div>`; // XSS-safe
const speed = units`100 km/h`; // Dimensional analysis
```

### Typeclasses (Advanced)

For library authors — define new typeclasses that integrate with implicit resolution:

```typescript
import { typeclass, instance } from "@typesugar/typeclass";

// Define a typeclass
@typeclass
interface Serialize<A> {
  serialize(a: A): Uint8Array;
  deserialize(bytes: Uint8Array): A;
}

// Provide a custom instance when needed
@instance
const serializePoint: Serialize<Point> = {
  serialize: (p) => new Uint8Array([p.x, p.y]),
  deserialize: (b) => ({ x: b[0], y: b[1] }),
};

// Now it just works
const bytes = myPoint.serialize();  // Uses custom instance, zero-cost
```

### Operator Overloading

Standard operators resolve to typeclass methods automatically:

```typescript
interface Vec2 { x: number; y: number }

// Define how Vec2 handles + via the Semigroup typeclass
@instance
const vec2Semigroup: Semigroup<Vec2> = {
  combine: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
};

// Now + just works on Vec2
const a: Vec2 = { x: 1, y: 2 };
const b: Vec2 = { x: 3, y: 4 };
const c = a + b;  // Compiles to: { x: a.x + b.x, y: a.y + b.y }

// Custom operators for domain-specific types
@operators({ "*": "scale" })
class Matrix { /* ... */ }
```

### Effect-TS Integration

```typescript
import { service, layer, resolveLayer, EffectSchema } from "@typesugar/effect";
import { Effect } from "effect";

// Zero-boilerplate services
@service
interface UserRepo {
  findById(id: string): Effect.Effect<User, NotFound>
}

// Layers with dependency tracking
@layer(UserRepo, { requires: [Database] })
const userRepoLive =
let: {
  db << Database;
}
yield: ({ findById: (id) => db.query(...) })

// Automatic layer composition
const runnable = program.pipe(
  Effect.provide(resolveLayer<UserRepo | EmailService>())
);

// Auto-derive Effect Schema
@derive(EffectSchema)
interface User { id: string; name: string; }
// Generates: export const UserSchema = Schema.Struct({ ... })
```

## Documentation

See the [docs/](docs/) directory:

- [Getting Started](docs/getting-started.md)
- [Macro Types](docs/macro-types.md)
- [Writing Macros](docs/writing-macros.md)
- [Architecture](docs/architecture.md)
- [FAQ](docs/faq.md)
- [Vision](docs/vision/index.md) — Future features (reactivity, components, Fx effects, Effect-TS integration)

## Safety

- **Sandboxed** — `comptime` runs in a restricted `vm` context (no filesystem, network, or process access)
- **Timeout** — 5-second limit on compile-time evaluation
- **Loud failures** — failed expansions emit `throw new Error(...)` so bugs are never silent
- **Diagnostics** — all errors flow through the TypeScript diagnostic pipeline

## Developer Experience

- **Rust-style errors** — rich diagnostics with code snippets, labeled spans, and fix suggestions
- **"Did you mean?"** — import suggestions when symbols aren't in scope
- **No false positives** — ESLint/language service automatically handle typesugar imports
- **Opt-out** — disable transformations per-file, per-function, or per-line with `"use no typesugar"` or `// @ts-no-typesugar`

## License

MIT
