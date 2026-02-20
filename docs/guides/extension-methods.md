# Extension Methods

typesugar supports Scala 3-style extension methods for adding functionality to existing types.

## Two Types of Extensions

### 1. Typeclass Extensions

Methods from typeclass instances:

```typescript
import { extend } from "@typesugar/typeclass";
import { Show, Eq } from "@typesugar/std";

extend(42).show(); // "42" (from Show<number>)
extend("hi").show(); // "\"hi\""
```

### 2. Standalone Extensions

Methods added to specific types:

```typescript
import { extend } from "@typesugar/std";
import { NumberExt, StringExt } from "@typesugar/std";

extend(42).clamp(0, 100); // 42
extend("hello").capitalize(); // "Hello"
```

## Using Extensions

### With extend()

```typescript
import { extend } from "@typesugar/std";

const clamped = extend(150).clamp(0, 100); // 100
const upper = extend("hello").toUpperCase(); // "HELLO"
```

### Import-Scoped Extensions

Extensions are discovered from imports:

```typescript
import { clamp } from "@typesugar/std";

// The transformer sees clamp is imported and rewrites:
(42).clamp(0, 100); // → clamp(42, 0, 100)
```

## Built-in Extensions

### Number Extensions

```typescript
import { NumberExt } from "@typesugar/std";

extend(42).clamp(0, 100); // Clamp to range
extend(42).times(fn); // Call fn 42 times
extend(3.14159).round(2); // 3.14
extend(42).isEven(); // true
extend(42).isOdd(); // false
extend(7).isPrime(); // true
```

### String Extensions

```typescript
import { StringExt } from "@typesugar/std";

extend("hello").capitalize(); // "Hello"
extend("hello world").titleCase(); // "Hello World"
extend("  hi  ").strip(); // "hi"
extend("hello").reverse(); // "olleh"
extend("hello").truncate(3); // "hel..."
```

### Array Extensions

```typescript
import { ArrayExt } from "@typesugar/std";

extend([1, 2, 3]).first(); // Some(1)
extend([1, 2, 3]).last(); // Some(3)
extend([1, 2, 3]).isEmpty(); // false
extend([1, 2, 3]).nonEmpty(); // true
extend([1, 2, 3]).partition((x) => x > 1); // [[2, 3], [1]]
extend([1, 2, 3]).groupBy((x) => x % 2); // Map { 1: [1, 3], 0: [2] }
```

## Creating Extensions

### For Concrete Types

```typescript
// my-extensions.ts
export function double(n: number): number {
  return n * 2;
}

export function greet(name: string): string {
  return `Hello, ${name}!`;
}
```

Usage:

```typescript
import { double, greet } from "./my-extensions";

// Automatically discovered
(42)
  .double()(
    // → double(42) → 84
    "Alice",
  )
  .greet(); // → greet("Alice") → "Hello, Alice!"
```

### Extension Namespaces

```typescript
// math-ext.ts
export const MathExt = {
  square(n: number): number {
    return n * n;
  },
  cube(n: number): number {
    return n * n * n;
  },
};
```

Usage:

```typescript
import { MathExt } from "./math-ext";

extend(3).square(); // 9
extend(3).cube(); // 27
```

### Registering Extensions Explicitly

```typescript
import { registerExtensions, registerExtension } from "@typesugar/std";

registerExtensions<number>(MathExt);
registerExtension<string>(myStringFunction);
```

## How Resolution Works

When the transformer encounters `value.method()` where `method` doesn't exist on the type:

1. **Typeclass registry**: Check if any typeclass instance provides `method`
2. **Standalone registry**: Check explicit `registerExtensions()` calls
3. **Import scan**: Check all imports for a matching function

```typescript
import { clamp } from "@typesugar/std";

(42).clamp(0, 100);
// 1. No typeclass has clamp for number
// 2. No explicit registration
// 3. Found: clamp(number, number, number) in imports
// → clamp(42, 0, 100)
```

## Typeclass Extensions

When you define a typeclass instance, its methods become extensions:

```typescript
@typeclass
interface Printable<A> {
  print(a: A): void;
}

@instance
const PrintableNumber: Printable<number> = {
  print: (n) => console.log(n),
};

extend(42).print();  // Calls PrintableNumber.print(42)
```

## Precedence

1. **Own methods**: Type's own methods always win
2. **Typeclass methods**: Checked first for polymorphism
3. **Standalone extensions**: Import-scoped functions

```typescript
class MyClass {
  show(): string {
    return "own method";
  }
}

// This calls the class method, not Show<MyClass>.show
new MyClass().show();
```

## Generic Extensions

```typescript
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

// Works with any array
extend([1, 2, 3]).first(); // 1
extend(["a", "b"]).first(); // "a"
```

## Best Practices

### Do

- Use namespaces to organize related extensions
- Keep extension functions pure
- Document extensions in your package

### Don't

- Shadow built-in methods unintentionally
- Create extension with side effects
- Register the same extension twice

## Comparison to Other Languages

| Feature           | typesugar            | Scala 3    | Kotlin       | C#           |
| ----------------- | -------------------- | ---------- | ------------ | ------------ |
| Syntax            | `extend(x).method()` | `x.method` | `x.method()` | `x.Method()` |
| Import-scoped     | Yes                  | Yes        | Yes          | Yes          |
| Typeclass-derived | Yes                  | Yes        | No           | No           |
| Zero-cost         | Yes                  | Yes        | Yes          | Yes          |
