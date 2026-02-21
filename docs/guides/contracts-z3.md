# Z3 SMT Solver Proofs

Use the Z3 theorem prover to verify contract conditions at compile time. For conditions that built-in rules can't handle, Z3 proves complex arithmetic and logical formulas.

## Quick Start

```bash
npm install @typesugar/contracts-z3
```

```typescript
import { registerProverPlugin } from "@typesugar/contracts";
import { z3ProverPlugin } from "@typesugar/contracts-z3";

// Register Z3 as a prover plugin
registerProverPlugin(z3ProverPlugin({ timeout: 2000 }));

// Or auto-register on import:
import "@typesugar/contracts-z3";
```

## Usage

```typescript
import { contract } from "@typesugar/contracts";

@contract
function sqrt(x: number): number {
  requires: { x >= 0 }
  ensures: { result >= 0 && result * result <= x && (result + 1) * (result + 1) > x }
  // Complex postcondition proven via Z3
  return Math.sqrt(x);
}
```

## How It Works

1. Translates predicate strings + type facts into Z3 assertions
2. Adds the negation of the goal
3. If Z3 returns UNSAT, the goal is proven (negation is impossible)
4. If Z3 returns SAT or UNKNOWN, the goal is not proven

## Supported Syntax

| Category        | Operators                          |
| --------------- | ---------------------------------- |
| **Arithmetic**  | `+`, `-`, `*`, `/`, `%`            |
| **Comparisons** | `>`, `>=`, `<`, `<=`, `===`, `!==` |
| **Logical**     | `&&`, `\|\|`, `!`                  |

## Standalone Usage

```typescript
import { proveWithZ3Async } from "@typesugar/contracts-z3";

const result = await proveWithZ3Async("x + y > 0", [
  { variable: "x", predicate: "x > 0" },
  { variable: "y", predicate: "y >= 0" },
]);

if (result.proven) {
  console.log("Goal proven via Z3");
}
```

## Learn More

- [Contracts Guide](/guides/contracts)
- [API Reference](/reference/packages#contracts-z3)
