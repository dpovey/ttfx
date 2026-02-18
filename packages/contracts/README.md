# @ttfx/contracts

> Design by Contract for TypeScript with compile-time proof elimination.

## Overview

`@ttfx/contracts` provides Eiffel/Dafny-style contracts with a multi-layer proof engine that eliminates runtime checks when conditions can be proven at compile time.

```typescript
import { requires, ensures, old } from "@ttfx/contracts";
import { Positive } from "@ttfx/type-system";

function withdraw(account: Account, amount: Positive): number {
  requires(account.balance >= amount, "Insufficient funds");
  ensures(account.balance === old(account.balance) - amount);

  account.balance -= amount;
  return account.balance;
}
```

## Installation

```bash
npm install @ttfx/contracts
# For refined type integration:
npm install @ttfx/contracts-refined @ttfx/type-system
```

## Features

### Core Contracts

| Construct                   | Description                                    |
| --------------------------- | ---------------------------------------------- |
| `requires(condition, msg?)` | Precondition — checked at function entry       |
| `ensures(condition, msg?)`  | Postcondition — checked at function exit       |
| `old(expr)`                 | Capture pre-call value (inside ensures)        |
| `@contract`                 | Enable `requires:`/`ensures:` labeled blocks   |
| `@invariant(predicate)`     | Class invariant — checked after public methods |

### Proof Engine

The prover runs layers in order, stopping at first success:

1. **Constant evaluation** — Static values (`true`, `5 > 3`)
2. **Type deduction** — Facts from `Refined<T, Brand>` types
3. **Algebraic rules** — Pattern matching (`a > 0 ∧ b > 0 → a + b > 0`)
4. **Linear arithmetic** — Fourier-Motzkin elimination
5. **Prover plugins** — External solvers (Z3)

### Coq-Inspired Extensions

#### Decidability Annotations

Mark predicates with their decidability level to control proof strategy and warnings:

```typescript
import { decidable, registerDecidability } from "@ttfx/contracts";

// Decorator form
@decidable("compile-time", "constant")
type Literal42 = Refined<number, "Literal42">;

// Programmatic form
registerDecidability({
  brand: "Positive",
  predicate: "$ > 0",
  decidability: "compile-time",
  preferredStrategy: "algebra",
});
```

| Level            | Meaning                           |
| ---------------- | --------------------------------- |
| `"compile-time"` | Always provable at compile time   |
| `"decidable"`    | Decidable, may need SMT solver    |
| `"runtime"`      | Must check at runtime             |
| `"undecidable"`  | Cannot be decided algorithmically |

#### Decidability Warnings

Configure warnings when proofs fall back to runtime:

```typescript
// ttfx.config.ts
export default {
  contracts: {
    decidabilityWarnings: {
      warnOnFallback: "warn", // "off" | "warn" | "error"
      warnOnSMT: "info",
      ignoreBrands: ["DynamicCheck"],
    },
  },
};
```

#### Subtyping Coercions

Register safe type coercions for automatic widening:

```typescript
import { registerSubtypingRule, canWiden } from "@ttfx/contracts";

registerSubtypingRule({
  from: "Positive",
  to: "NonNegative",
  proof: "positive_implies_non_negative",
  justification: "x > 0 implies x >= 0",
});

canWiden("Positive", "NonNegative"); // true
```

#### Linear Arithmetic Solver

Proves linear inequalities via Fourier-Motzkin elimination:

```typescript
import { tryLinearArithmetic, trySimpleLinearProof } from "@ttfx/contracts";

// Given: x > 0, y >= 0
// Proves: x + y >= 0
const result = trySimpleLinearProof("x + y >= 0", [
  { variable: "x", predicate: "x > 0" },
  { variable: "y", predicate: "y >= 0" },
]);
// result.proven === true
```

Supported patterns:

- Transitivity: `x > y ∧ y > z → x > z`
- Sum bounds: `x >= a ∧ y >= b → x + y >= a + b`
- Positive implies non-negative: `x > 0 → x >= 0`
- Equality bounds: `x === c → x >= c ∧ x <= c`

#### Proof Certificates

Generate structured proof traces for debugging:

```typescript
import {
  createCertificate,
  succeedCertificate,
  formatCertificate,
} from "@ttfx/contracts";

const facts = [{ variable: "x", predicate: "x > 0" }];
let cert = createCertificate("x >= 0", facts);

// Add proof steps...
cert = succeedCertificate(cert, "linear", {
  rule: "positive_implies_nonneg",
  description: "x > 0 implies x >= 0",
});

console.log(formatCertificate(cert));
// Certificate for: x >= 0
// Status: PROVEN (linear)
// Steps:
//   1. [positive_implies_nonneg] x > 0 implies x >= 0
```

## Usage Examples

### Inline Style

```typescript
import { requires, ensures, old } from "@ttfx/contracts";

function deposit(account: Account, amount: Positive): void {
  requires(amount > 0); // PROVEN: Positive type
  ensures(account.balance === old(account.balance) + amount);

  account.balance += amount;
}
```

### Block Style

```typescript
@contract
function withdraw(account: Account, amount: Positive): Balance {
  requires: {
    account.balance >= amount;
    !account.frozen;
  }
  ensures: (result) => {
    result === old(account.balance) - amount;
  }

  account.balance -= amount;
  return Balance.refine(account.balance);
}
```

### Class Invariants

```typescript
@invariant((self) => self.balance >= 0, "Balance must be non-negative")
class BankAccount {
  balance = 0;

  deposit(amount: Positive): void {
    this.balance += amount;
  }
}
```

### Custom Algebraic Rules

```typescript
import { registerAlgebraicRule } from "@ttfx/contracts";

registerAlgebraicRule({
  name: "percentage_bounds",
  description: "Percentage is 0-100",
  match(goal, facts) {
    const m = goal.match(/^(\w+)\s*<=\s*100$/);
    if (!m) return false;
    return facts.some(
      (f) => f.variable === m[1] && f.predicate.includes("Percentage"),
    );
  },
});
```

## Integration with @ttfx/type-system

Import `@ttfx/contracts-refined` to connect the prover with refined types:

```typescript
// REQUIRED: Registers all built-in predicates
import "@ttfx/contracts-refined";

import { Positive, Byte, Port } from "@ttfx/type-system";

function processPort(port: Port): void {
  requires(port >= 1); // PROVEN: Port guarantees >= 1
  requires(port <= 65535); // PROVEN: Port guarantees <= 65535
}
```

## Configuration

### Via ttfx.config.ts

```typescript
export default {
  contracts: {
    mode: "full", // "full" | "assertions" | "none"
    proveAtCompileTime: true,
    decidabilityWarnings: {
      warnOnFallback: "warn",
      warnOnSMT: "off",
      ignoreBrands: [],
    },
  },
};
```

### Via Environment Variable

```bash
TTFX_CONTRACTS_MODE=none npm run build  # Production: strip all checks
```

### Mode Reference

| Mode           | Preconditions | Postconditions | Invariants |
| -------------- | ------------- | -------------- | ---------- |
| `"full"`       | Emitted       | Emitted        | Emitted    |
| `"assertions"` | Stripped      | Stripped       | Emitted    |
| `"none"`       | Stripped      | Stripped       | Stripped   |

## API Reference

### Core Functions

- `requires(condition, message?)` — Precondition check
- `ensures(condition, message?)` — Postcondition check
- `old(expression)` — Capture pre-call value

### Prover API

- `tryProve(ctx, condition, fn)` — Attempt compile-time proof
- `tryAlgebraicProof(goal, facts)` — Algebraic pattern matching
- `tryLinearArithmetic(goal, facts)` — Fourier-Motzkin solver
- `trySimpleLinearProof(goal, facts)` — Fast linear patterns

### Decidability API

- `registerDecidability(info)` — Register decidability for a brand
- `getDecidability(brand)` — Get decidability info
- `isCompileTimeDecidable(brand)` — Check if compile-time provable
- `canProveAtCompileTime(level)` — Check decidability level
- `emitDecidabilityWarning(info)` — Emit configured warning

### Subtyping API

- `registerSubtypingRule(rule)` — Register widening rule
- `canWiden(from, to)` — Check if subtyping exists
- `getSubtypingRule(from, to)` — Get rule details
- `getWidenTargets(from)` — Get all widen targets

### Certificate API

- `createCertificate(goal, assumptions)` — Start certificate
- `succeedCertificate(cert, method, step)` — Mark proven
- `failCertificate(cert, reason)` — Mark failed
- `addStep(cert, step)` — Add proof step
- `formatCertificate(cert)` — Human-readable output

## Package Structure

```
packages/contracts/src/
  index.ts              # Public API
  config.ts             # Configuration + decidability warnings
  macros/
    requires.ts         # requires() expression macro
    ensures.ts          # ensures() expression macro
    old.ts              # old() capture + hoisting
    contract.ts         # @contract attribute macro
    invariant.ts        # @invariant attribute macro
    decidable.ts        # @decidable annotation macro
  prover/
    index.ts            # tryProve() orchestration
    type-facts.ts       # Type fact extraction + subtyping
    algebra.ts          # Algebraic proof rules
    linear.ts           # Fourier-Motzkin solver
    certificate.ts      # Proof certificates
  parser/
    contract-block.ts   # Parse requires:/ensures: blocks
    predicate.ts        # Normalize predicates
```

## See Also

- `@ttfx/contracts-refined` — Bridges contracts with type-system
- `@ttfx/contracts-z3` — Z3 SMT solver plugin
- `@ttfx/type-system` — Refined types (Positive, Byte, etc.)

## License

MIT
