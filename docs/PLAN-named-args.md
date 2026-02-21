# Plan: Named Arguments Macro (Boost.Parameter-Style)

## Status: PHASE 1 IMPLEMENTED

Phase 1 (runtime namedArgs wrapper, callWithNamedArgs, builder pattern) is implemented in `packages/named-args/`. Phase 2 (compile-time call site rewriting via preprocessor) is future work.

## Inspiration

C++ Boost.Parameter lets you call functions with named arguments in any order, with defaults resolved at compile time. Python, Kotlin, and Swift have this as a language feature. TypeScript has object destructuring as a workaround, but it lacks:

- Mixing positional and named arguments
- Compile-time enforcement of required vs optional
- Zero-cost — object destructuring allocates a temporary object

This macro provides Kotlin/Swift-style named arguments that compile away to positional calls.

## The Problem

```typescript
// TypeScript workaround: options object
function createServer(options: {
  port: number;
  host?: string;
  tls?: boolean;
  maxConnections?: number;
}) { ... }

// Problems:
// 1. Allocates a temporary object at every call site
// 2. Can't mix positional and named: createServer(8080, { tls: true }) is awkward
// 3. IDE autocomplete shows the object type, not individual params
// 4. Can't have required params after optional ones
```

## Design

### `@namedArgs` Decorator

```typescript
import { namedArgs } from "@typesugar/named-args";

@namedArgs
function createServer(
  port: number,
  host: string = "localhost",
  tls: boolean = false,
  maxConnections: number = 100,
): Server { ... }

// Call with named arguments (any order)
createServer(port: 8080, tls: true);
// Compiles to: createServer(8080, "localhost", true, 100)

// Mix positional and named
createServer(8080, tls: true);
// Compiles to: createServer(8080, "localhost", true, 100)

// All positional (still works)
createServer(8080, "0.0.0.0", true, 50);
```

### Syntax

Named arguments use the `name: value` syntax at call sites. The macro distinguishes named args from positional by detecting the `identifier: expression` pattern that isn't a valid positional argument.

**Ambiguity resolution:** If a function parameter is named `x` and the call site has `x: 5`, this could be:

- Named argument: `x` gets value `5`
- Object literal shorthand: `{ x: 5 }` as first positional arg

The macro resolves this by checking if the function has `@namedArgs`. If it does, `x: 5` is a named argument. If not, it's treated as a normal expression.

### Compile-Time Checks

```typescript
@namedArgs
function connect(host: string, port: number, timeout: number = 5000): void { ... }

connect(port: 8080, host: "localhost");           // OK: reordered
connect(host: "localhost", port: 8080);           // OK: same
connect("localhost", port: 8080);                 // OK: positional + named
connect(host: "localhost");                       // Error: missing required 'port'
connect(host: "localhost", port: 8080, foo: 1);   // Error: unknown parameter 'foo'
connect(host: "localhost", host: "other");        // Error: duplicate 'host'
```

### Builder Pattern Generation

For functions with many parameters, `@namedArgs` can generate a builder:

```typescript
@namedArgs({ builder: true })
function createWidget(
  width: number,
  height: number,
  color: string = "white",
  border: boolean = false,
  shadow: boolean = false,
  opacity: number = 1.0,
  zIndex: number = 0,
): Widget { ... }

// Builder style (for >5 params)
createWidget
  .width(100)
  .height(200)
  .color("red")
  .shadow(true)
  .build();

// Compiles to: createWidget(100, 200, "red", false, true, 1.0, 0)
```

### Class Constructors

```typescript
@namedArgs
class DatabasePool {
  constructor(
    connectionString: string,
    maxSize: number = 10,
    minSize: number = 2,
    idleTimeout: number = 30000,
    acquireTimeout: number = 5000,
  ) { ... }
}

const pool = new DatabasePool(
  connectionString: "postgres://...",
  maxSize: 20,
  idleTimeout: 60000,
);
// Compiles to: new DatabasePool("postgres://...", 20, 2, 60000, 5000)
```

## Implementation

### Phase 1: `@namedArgs` Attribute Macro

**Package:** `@typesugar/named-args` (or add to `@typesugar/std`)

**On the declaration side:**

1. Parse the decorated function's parameter list
2. Record parameter names, types, default values, and positions
3. Register the function in a named-args registry

**On the call site side (transformer integration):**

1. When visiting a call expression, check if the callee is registered in the named-args registry
2. Parse the arguments — detect `name: value` patterns
3. Reorder arguments to match parameter positions
4. Fill in defaults for missing optional parameters
5. Emit a normal positional call

### Phase 2: Preprocessor Support

The `name: value` syntax in function calls isn't valid TypeScript. Two options:

**Option A: Preprocessor rewrite**
The preprocessor rewrites `f(name: value)` to `f(/* __named_name__ */ value)` using magic comments. The transformer reads the comments and resolves the named arguments.

**Option B: Object literal syntax**
Use `f({ name: value })` at call sites. The macro detects the single-object-argument pattern and destructures it. Less magical, but allocates a temporary object (which V8 can often optimize away).

**Recommendation:** Option A for full zero-cost, with Option B as a fallback for environments without the preprocessor.

### Phase 3: Builder Generation

For functions with `{ builder: true }`:

1. Generate a builder class with one method per parameter
2. Each method returns the builder (for chaining)
3. `.build()` calls the original function with accumulated values
4. The macro inlines the builder — no builder object at runtime

### Phase 4: IDE Integration

Language service plugin additions:

- Parameter name hints at call sites (like VS Code's inlay hints, but richer)
- Autocomplete suggests parameter names after `(`
- Quick fix: convert positional call to named

## Zero-Cost Verification

```typescript
// createServer(port: 8080, tls: true)
// Must compile to exactly:
createServer(8080, "localhost", true, 100);
// No object allocation, no spread, no runtime resolution
```

## Inspirations

- **Boost.Parameter** — named parameters via template metaprogramming
- **Kotlin** — named arguments (`fun connect(host: String, port: Int)` → `connect(port = 8080, host = "localhost")`)
- **Swift** — argument labels (`func connect(to host: String, on port: Int)`)
- **Python** — keyword arguments (`connect(host="localhost", port=8080)`)

## Dependencies

- `@typesugar/core` — attribute macros
- `@typesugar/transformer` — call site rewriting
- `@typesugar/preprocessor` — (optional) `name: value` syntax support

## Open Questions

1. Which syntax? `f(name: value)` requires preprocessor support. `f({ name: value })` works without preprocessor but allocates. `f(name = value)` conflicts with assignment expressions.
2. Should named args work across module boundaries? The transformer needs to see the `@namedArgs` declaration to rewrite call sites. For external libraries, we'd need declaration file annotations.
3. How to handle rest parameters? `@namedArgs function f(a: number, ...rest: string[])` — named args only apply to pre-rest params.
4. Should this interact with `@implicits`? E.g., `@namedArgs @implicits function f(x: number, show: Show<number>)` — `show` is resolved implicitly, `x` is named.
