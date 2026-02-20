# typesugar

**TypeScript that F\*cks! Compile-time macros. Zero runtime. Full type safety.**

> _What if TypeScript had `comptime`? What if `@derive` just worked? What if your tagged templates ran at build time?_

typesugar brings compile-time metaprogramming to TypeScript, drawing from the best ideas in Rust, Scala 3, and Zig — and making them feel native to the TypeScript ecosystem.

```typescript
import { comptime } from "@typesugar/comptime";
import { derive } from "@typesugar/derive";
import { sql } from "@typesugar/sql";

// Evaluate at compile time — gone before your code ships
const LOOKUP = comptime(() => {
  const table: Record<string, number> = {};
  for (let i = 0; i < 256; i++) table[String.fromCharCode(i)] = i;
  return table;
});

// Auto-derive common implementations
@derive(Eq, Ord, Clone, Debug, Json)
class Point {
  constructor(
    public x: number,
    public y: number,
  ) {}
}

// Type-safe SQL with compile-time validation
const query = sql`SELECT * FROM users WHERE id = ${userId}`;
```

## Why typesugar?

| Feature                  | typesugar                              | ts-macros               | Babel macros |
| ------------------------ | --------------------------------- | ----------------------- | ------------ |
| **Type-aware**           | Yes — reads the type checker      | No                      | No           |
| **Compile-time eval**    | Full JS via `vm` sandbox          | `$comptime` (similar)   | No           |
| **Derive macros**        | `@derive(Eq, Ord, Debug, ...)`    | Manual                  | No           |
| **Tagged templates**     | First-class macro category        | Via expression macros   | No           |
| **Reflection**           | `typeInfo<T>()`, `validator<T>()` | No                      | No           |
| **Typeclasses**          | Scala 3-style `@typeclass`        | No                      | No           |
| **Operator overloading** | `@operators` + `ops()`            | No                      | No           |
| **Safety**               | Sandboxed, timeout, loud failures | `$raw` runs unsandboxed | N/A          |

## Packages

### Core

| Package                                   | Description                  |
| ----------------------------------------- | ---------------------------- |
| [typesugar](packages/typesugar)                     | Umbrella package             |
| [@typesugar/transformer](packages/transformer) | Core TypeScript transformer  |
| [@typesugar/core](packages/core)               | Macro registration and types |
| [@typesugar/comptime](packages/comptime)       | Compile-time evaluation      |
| [@typesugar/derive](packages/derive)           | Auto-derive implementations  |
| [@typesugar/reflect](packages/reflect)         | Type reflection              |
| [@typesugar/operators](packages/operators)     | Operator overloading         |

### Typeclasses & FP

| Package                                 | Description                         |
| --------------------------------------- | ----------------------------------- |
| [@typesugar/typeclass](packages/typeclass)   | Scala 3-style typeclasses           |
| [@typesugar/specialize](packages/specialize) | Zero-cost specialization            |
| [@typesugar/fp](packages/fp)                 | Functional programming library      |
| [@typesugar/std](packages/std)               | Standard typeclasses and extensions |

### Contracts

| Package                                               | Description               |
| ----------------------------------------------------- | ------------------------- |
| [@typesugar/contracts](packages/contracts)                 | Design by contract        |
| [@typesugar/contracts-refined](packages/contracts-refined) | Refinement types          |
| [@typesugar/contracts-z3](packages/contracts-z3)           | Z3 SMT solver integration |

### Domain-Specific

| Package                                   | Description                         |
| ----------------------------------------- | ----------------------------------- |
| [@typesugar/sql](packages/sql)                 | Type-safe SQL                       |
| [@typesugar/react](packages/react)             | React macros                        |
| [@typesugar/strings](packages/strings)         | String validation macros            |
| [@typesugar/units](packages/units)             | Physical units                      |
| [@typesugar/type-system](packages/type-system) | Advanced types (HKT, Newtype, etc.) |

### Integrations

| Package                         | Description           |
| ------------------------------- | --------------------- |
| [@typesugar/effect](packages/effect) | Effect-TS integration |
| [@typesugar/kysely](packages/kysely) | Kysely integration    |

### Tooling

| Package                                       | Description                                      |
| --------------------------------------------- | ------------------------------------------------ |
| [unplugin-typesugar](packages/unplugin-typesugar)       | Bundler plugins (Vite, Webpack, esbuild, Rollup) |
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

### Derive Macros

```typescript
import { derive } from "@typesugar/derive";

@derive(Eq, Ord, Clone, Debug, Json, Builder)
class User {
  id: number;
  name: string;
  email: string;
}
// Generates: equals(), compare(), clone(), debug(), toJson(), fromJson(), builder()
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

### Typeclasses

```typescript
import { typeclass, deriving, summon } from "@typesugar/typeclass";

@typeclass
interface Show<A> {
  show(a: A): string;
}

@deriving(Show, Eq, Ord)
class Point {
  constructor(public x: number, public y: number) {}
}

const s = summon<Show<Point>>();
s.show(new Point(1, 2)); // "Point(x = 1, y = 2)"
```

### Operator Overloading

```typescript
import { operators, ops } from "@typesugar/operators";

@operators({ "+": "add", "*": "scale" })
class Vec2 {
  constructor(
    public x: number,
    public y: number,
  ) {}
  add(other: Vec2) {
    return new Vec2(this.x + other.x, this.y + other.y);
  }
  scale(n: number) {
    return new Vec2(this.x * n, this.y * n);
  }
}

const result = ops(a + b * 2); // Compiles to: a.add(b.scale(2))
```

## Documentation

See the [docs/](docs/) directory:

- [Getting Started](docs/getting-started.md)
- [Macro Types](docs/macro-types.md)
- [Writing Macros](docs/writing-macros.md)
- [Architecture](docs/architecture.md)
- [FAQ](docs/faq.md)

## Safety

- **Sandboxed** — `comptime` runs in a restricted `vm` context (no filesystem, network, or process access)
- **Timeout** — 5-second limit on compile-time evaluation
- **Loud failures** — failed expansions emit `throw new Error(...)` so bugs are never silent
- **Diagnostics** — all errors flow through the TypeScript diagnostic pipeline

## License

MIT
