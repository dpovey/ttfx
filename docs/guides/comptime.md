# Compile-Time Evaluation

The `comptime()` macro evaluates expressions at build time and inlines the result.

## Basic Usage

```typescript
import { comptime } from "@typesugar/comptime";

// Simple expression
const answer = comptime(21 * 2); // → const answer = 42;

// Function call
const buildTime = comptime(new Date().toISOString());
// → const buildTime = "2024-01-15T10:30:00.000Z";

// Arrow function body
const factorial10 = comptime(() => {
  const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
  return fact(10);
});
// → const factorial10 = 3628800;
```

## What Can Be Evaluated

### Supported

- Arithmetic and logical operations
- String manipulation
- Array methods (map, filter, reduce, etc.)
- Object creation and manipulation
- JSON parsing and serialization
- Math functions
- Date operations
- Regular expressions (creation, not execution)
- Recursion (with limits)

### Not Supported

- File system access
- Network requests
- Process/environment access (sandboxed)
- DOM APIs
- Node.js built-in modules
- External package imports (in most cases)

## Use Cases

### Build Information

```typescript
const BUILD_INFO = comptime({
  version: "1.0.0",
  buildTime: new Date().toISOString(),
  commit: process.env.GIT_COMMIT ?? "dev",
});
```

### Lookup Tables

```typescript
const ASCII_TABLE = comptime(() => {
  const table: Record<string, number> = {};
  for (let i = 0; i < 128; i++) {
    table[String.fromCharCode(i)] = i;
  }
  return table;
});
```

### Precomputed Data

```typescript
const PRIMES = comptime(() => {
  const sieve = (n: number): number[] => {
    const prime = new Array(n + 1).fill(true);
    prime[0] = prime[1] = false;
    for (let i = 2; i * i <= n; i++) {
      if (prime[i]) {
        for (let j = i * i; j <= n; j += i) {
          prime[j] = false;
        }
      }
    }
    return prime.map((p, i) => (p ? i : -1)).filter((x) => x > 0);
  };
  return sieve(1000);
});
```

### Configuration Parsing

```typescript
const CONFIG = comptime(() => {
  const raw = `
    host: localhost
    port: 3000
    debug: true
  `;
  const lines = raw.trim().split("\n");
  const config: Record<string, string> = {};
  for (const line of lines) {
    const [key, value] = line.split(":").map((s) => s.trim());
    config[key] = value;
  }
  return config;
});
```

## Evaluation Rules

### Expressions vs Functions

Simple expressions evaluate directly:

```typescript
comptime(1 + 1); // Evaluates: 1 + 1
```

Arrow functions evaluate the function body:

```typescript
comptime(() => {
  // This entire block runs at compile time
  let x = 0;
  for (let i = 0; i < 10; i++) x += i;
  return x;
});
```

### Type Inference

The result type is inferred from the computed value:

```typescript
const num = comptime(42); // number
const str = comptime("hello"); // string
const arr = comptime([1, 2, 3]); // number[]
const obj = comptime({ x: 1 }); // { x: number }
```

### Serialization

Results must be JSON-serializable:

```typescript
// Works
comptime({ x: 1, y: [1, 2] });

// Fails - functions can't be serialized
comptime(() => () => 42);

// Fails - circular references
comptime(() => {
  const obj: any = {};
  obj.self = obj;
  return obj;
});
```

## Error Handling

Compile-time errors become build errors:

```typescript
// Build error: Division by zero
comptime(1 / 0);

// Build error: Undefined is not a function
comptime(() => {
  const x: any = undefined;
  return x.foo();
});
```

## Timeout

Evaluation has a default 5-second timeout:

```typescript
// Build error: Timeout
comptime(() => {
  while (true) {} // Infinite loop
});
```

## Environment Variables

Access is sandboxed by default. To use env vars, pass them explicitly:

```typescript
// Won't work - process is sandboxed
comptime(process.env.API_KEY);

// Works if the var exists at build time
const API_KEY = comptime(process.env.API_KEY ?? "default");
```

## Debugging

To see what comptime evaluates to:

```bash
npx typesugar expand src/file.ts
```

Or enable verbose mode:

```json
{
  "compilerOptions": {
    "plugins": [{ "transform": "@typesugar/transformer", "verbose": true }]
  }
}
```

## Best Practices

### Do

- Use for expensive computations that don't change
- Pre-compute lookup tables
- Embed build information
- Parse static configuration

### Don't

- Use for runtime-dependent values
- Access external resources
- Create very large objects (increases bundle size)
- Use side effects (they happen at build time!)

## Comparison to Other Systems

| Feature       | typesugar `comptime` | Zig `comptime` | Rust `const fn` |
| ------------- | -------------------- | -------------- | --------------- |
| Full language | Yes                  | Yes            | Limited         |
| Sandboxed     | Yes                  | No             | N/A             |
| Result types  | JSON-serializable    | Any            | Any             |
| Recursion     | Yes (limited)        | Yes            | Yes             |
| Loops         | Yes                  | Yes            | Yes (nightly)   |
