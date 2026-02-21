# Refined Types Integration

Bridge refinement types with compile-time contract verification. Import once to enable the prover to understand refinement predicates.

## Quick Start

```bash
npm install @typesugar/contracts-refined
```

```typescript
// Enable refined type predicates for the prover
import "@typesugar/contracts-refined";

import { Positive, Byte } from "@typesugar/type-system";
import { contract } from "@typesugar/contracts";

@contract
function add(a: Positive, b: Positive): number {
  requires: { a > 0 && b > 0 } // Proven by type!
  ensures: { result > 0 }      // Also provable
  return a + b;
}
```

## What Gets Registered

All built-in refinement types from `@typesugar/type-system`:

| Category      | Types                                                          |
| ------------- | -------------------------------------------------------------- |
| **Numeric**   | `Positive`, `NonNegative`, `Int`, `Byte`, `Port`, `Percentage` |
| **String**    | `NonEmpty`, `Trimmed`, `Email`, `Url`, `Uuid`                  |
| **Array**     | `NonEmptyArray`                                                |
| **Dependent** | `Vec<N>` (length-indexed vectors)                              |

## Subtyping Rules

The integration registers safe widening rules:

- `Positive` → `NonNegative` (x > 0 implies x >= 0)
- `Byte` → `NonNegative`, `Int`
- `Port` → `Positive`, `NonNegative`, `Int`

## Custom Refinements

```typescript
import { registerRefinementPredicate } from "@typesugar/contracts-refined";

registerRefinementPredicate("PositiveEven", "$ > 0 && $ % 2 === 0");

type PositiveEven = Refined<number, "PositiveEven">;

@contract
function halve(n: PositiveEven): number {
  ensures: { result > 0 }  // Provable!
  return n / 2;
}
```

## Learn More

- [Contracts Guide](/guides/contracts)
- [Type System Guide](/guides/type-system)
- [API Reference](/reference/packages#contracts-refined)
