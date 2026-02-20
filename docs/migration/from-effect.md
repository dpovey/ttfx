# typesugar for Effect Users

This guide maps Effect-TS concepts to their typesugar equivalents.

## Overview

| Effect          | typesugar             |
| --------------- | --------------------- |
| Effect<A, E, R> | Result<A, E> or IO<A> |
| pipe()          | pipe()                |
| gen             | let:/yield:           |
| Layer           | Direct injection      |

## Effect Types

### Effect → Result

```typescript
// Effect
import { Effect } from "effect";

const divide = (a: number, b: number): Effect.Effect<number, Error> =>
  b === 0 ? Effect.fail(new Error("Division by zero")) : Effect.succeed(a / b);

// typesugar
import { Result, Ok, Err } from "@typesugar/fp";

function divide(a: number, b: number): Result<number, Error> {
  return b === 0 ? Err(new Error("Division by zero")) : Ok(a / b);
}
```

### Effect for Side Effects → IO

```typescript
// Effect
const program = Effect.sync(() => console.log("Hello"));
Effect.runSync(program);

// typesugar
import { IO } from "@typesugar/fp";

const program = IO.of(() => console.log("Hello"));
program.unsafeRun();
```

## Pipe

```typescript
// Effect
import { pipe } from "effect";

const result = pipe(
  Effect.succeed(5),
  Effect.map((x) => x * 2),
  Effect.flatMap((x) => Effect.succeed(x + 1)),
);

// typesugar
import { pipe } from "@typesugar/operators";

const result = pipe(
  Ok(5),
  (r) => r.map((x) => x * 2),
  (r) => r.flatMap((x) => Ok(x + 1)),
);
```

## Generator Syntax → Do-Notation

### Effect.gen

```typescript
// Effect
const program = Effect.gen(function* () {
  const a = yield* Effect.succeed(1);
  const b = yield* Effect.succeed(2);
  return a + b;
});

// typesugar
let: {
  a << Ok(1);
  b << Ok(2);
}
yield: {
  a + b;
}
```

### With Error Handling

```typescript
// Effect
const program = Effect.gen(function* () {
  const user = yield* fetchUser(42);
  const posts = yield* fetchPosts(user.id);
  return { user, posts };
});

// typesugar
let: {
  user << fetchUser(42);
  posts << fetchPosts(user.id);
}
yield: {
  {
    (user, posts);
  }
}
```

## Option

```typescript
// Effect
import { Option } from "effect";

const maybeValue = Option.some(42);
const none = Option.none();

Option.match(maybeValue, {
  onSome: (x) => `Got ${x}`,
  onNone: () => "Nothing",
});

// typesugar
import { Option, Some, None, match } from "@typesugar/fp";

const maybeValue = Some(42);
const none = None;

match(maybeValue, {
  some: (x) => `Got ${x}`,
  none: () => "Nothing",
});
```

## Either

```typescript
// Effect
import { Either } from "effect";

const result = Either.right(42);
const error = Either.left("error");

// typesugar
import { Either, Right, Left } from "@typesugar/fp";

const result = Right(42);
const error = Left("error");
```

## Layers & Services

Effect uses layers for dependency injection. typesugar uses simpler patterns:

```typescript
// Effect
interface Database {
  query(sql: string): Effect.Effect<Result[]>;
}

const DatabaseLive = Layer.succeed(Database, {
  query: (sql) => Effect.succeed([]),
});

const program = Database.query("SELECT *").pipe(Effect.provide(DatabaseLive));

// typesugar: use typeclasses or simple DI
interface Database {
  query(sql: string): Promise<Result[]>;
}

function createProgram(db: Database) {
  return async () => {
    return await db.query("SELECT *");
  };
}

const program = createProgram(databaseImpl);
```

Or with typeclasses:

```typescript
import { typeclass, instance, summon } from "@typesugar/typeclass";

@typeclass
interface Database {
  query(sql: string): Promise<Result[]>;
}

@instance
const LiveDatabase: Database = {
  query: async (sql) => [...],
};

async function program() {
  const db = summon<Database>();
  return await db.query("SELECT *");
}
```

## Error Handling

### catchAll

```typescript
// Effect
const handled = Effect.catchAll(program, (error) => Effect.succeed("default"));

// typesugar
const handled = result.match({
  ok: (value) => value,
  err: (error) => "default",
});
```

### catchTag

```typescript
// Effect
const handled = Effect.catchTag(program, "NotFound", () =>
  Effect.succeed(null),
);

// typesugar
type MyError = { tag: "NotFound" } | { tag: "Unauthorized" };

const handled = result.mapErr((e) => {
  if (e.tag === "NotFound") return Ok(null);
  return Err(e);
});
```

## Concurrency

### all

```typescript
// Effect
const results = Effect.all([task1, task2, task3]);

// typesugar: with promises
const results = await Promise.all([task1, task2, task3]);

// typesugar: with Result
import { Result } from "@typesugar/fp";

const results = Result.all([result1, result2, result3]);
```

### race

```typescript
// Effect
const winner = Effect.race(task1, task2);

// typesugar
const winner = await Promise.race([task1, task2]);
```

## Zero-Cost Abstractions

Effect has runtime overhead for its effect tracking. typesugar compiles away:

```typescript
// Effect: runtime effect objects
const program = pipe(
  Effect.succeed(1),
  Effect.map((x) => x + 1),
); // Creates effect chain objects

// typesugar: compiled to direct code
import { specialize } from "@typesugar/specialize";

const process = specialize((x: number) => {
  return Ok(x).map((x) => x + 1);
});
// Compiles to: (x) => x + 1
```

## When to Use Each

### Use Effect

- Complex async/concurrent workflows
- Structured error handling with recovery
- Dependency injection via layers
- Resource management (acquire/release)

### Use typesugar

- Simpler functional patterns
- Zero-cost abstractions critical
- Integration with macro system
- Compile-time derivation needed

## Interop

Use both together:

```typescript
// Effect for complex orchestration
import { Effect } from "effect";

// typesugar for types and derivation
import { derive, Eq, Json } from "@typesugar/derive";

@derive(Eq, Json)
class User {
  constructor(
    public id: number,
    public name: string,
  ) {}
}

const program = Effect.gen(function* () {
  const data = yield* fetchData();
  return User.fromJson(data);
});
```
