# @typesugar/symbolic

Type-safe symbolic mathematics for TypeScript with compile-time type tracking, multiple rendering formats, evaluation, calculus operations, and algebraic simplification.

## Features

- **Type-Safe AST** - `Expression<T>` tracks result types at compile time
- **Rendering** - Output to plain text, LaTeX, or MathML
- **Evaluation** - Evaluate expressions with variable bindings
- **Calculus** - Symbolic differentiation, integration, and limits
- **Simplification** - Algebraic simplification with extensible rules
- **Pattern Matching** - Match and rewrite expressions
- **Equation Solving** - Solve linear and quadratic equations

## Installation

```bash
npm install @typesugar/symbolic
```

## Quick Start

```typescript
import {
  var_,
  const_,
  add,
  mul,
  pow,
  diff,
  integrate,
  simplify,
  toLatex,
  toText,
  evaluate,
  solve,
  PI,
} from "@typesugar/symbolic";

// Create variables and expressions
const x = var_("x");
const t = var_("t");

// Build expressions
const position = mul(const_(0.5), pow(t, const_(2))); // s = ½t²
const velocity = diff(position, "t"); // v = t
const acceleration = diff(velocity, "t"); // a = 1

// Render to different formats
toText(position); // "0.5 * t^2"
toLatex(position); // "0.5 t^{2}"

// Evaluate with variable bindings
evaluate(position, { t: 10 }); // 50

// Simplify expressions
const messy = add(x, add(const_(0), mul(const_(1), x)));
simplify(messy); // 2x

// Solve equations
const eq = add(mul(const_(2), x), const_(-6)); // 2x - 6 = 0
solve(eq, "x"); // { success: true, solutions: [const_(3)] }
```

## Expression Types

### Constants and Variables

```typescript
const c = const_(42); // numeric constant
const pi = const_(Math.PI, "π"); // named constant
const x = var_("x"); // variable
```

### Binary Operations

```typescript
add(a, b); // a + b
sub(a, b); // a - b
mul(a, b); // a * b
div(a, b); // a / b
pow(a, b); // a ^ b
```

### Unary Operations

```typescript
neg(a); // -a
abs(a); // |a|
sqrt(a); // √a
```

### Functions

```typescript
sin(x);
cos(x);
tan(x);
exp(x);
ln(x);
log(x);
// ... and more
```

### Calculus Constructs

```typescript
derivative(expr, "x"); // d/dx expr (symbolic)
integral(expr, "x"); // ∫ expr dx (symbolic)
limit(expr, "x", 0); // lim[x→0] expr
```

### Equations

```typescript
equation(left, right); // left = right
eq(left, right); // alias
```

### Summation and Product

```typescript
sum(expr, "i", from, to); // Σ[i=from..to] expr
product(expr, "i", from, to); // Π[i=from..to] expr
```

## Rendering

### Plain Text

```typescript
import { toText } from "@typesugar/symbolic";

toText(pow(x, const_(2))); // "x^2"
toText(div(const_(1), x)); // "1 / x"
toText(sin(x)); // "sin(x)"
```

### LaTeX

```typescript
import { toLatex } from "@typesugar/symbolic";

toLatex(pow(x, const_(2))); // "x^{2}"
toLatex(div(const_(1), x)); // "\\frac{1}{x}"
toLatex(sqrt(x)); // "\\sqrt{x}"
```

### MathML

```typescript
import { toMathML } from "@typesugar/symbolic";

toMathML(pow(x, const_(2)));
// <math><msup><mi>x</mi><mn>2</mn></msup></math>
```

## Evaluation

```typescript
import { evaluate, partialEvaluate } from "@typesugar/symbolic";

const expr = add(mul(x, x), mul(const_(2), x));
evaluate(expr, { x: 3 }); // 15 (9 + 6)

// Partial evaluation
const partial = partialEvaluate(add(x, const_(1)), {});
// Returns: add(x, const_(1)) - no change, x is unbound

const partial2 = partialEvaluate(add(x, add(const_(1), const_(2))), {});
// Returns: add(x, const_(3)) - constants folded
```

## Differentiation

```typescript
import { diff, nthDiff } from "@typesugar/symbolic";

// Basic derivatives
diff(pow(x, const_(2)), "x"); // 2x
diff(sin(x), "x"); // cos(x)
diff(exp(x), "x"); // exp(x)
diff(ln(x), "x"); // 1/x

// Higher-order derivatives
nthDiff(pow(x, const_(3)), "x", 2); // 6x

// Chain rule is applied automatically
diff(sin(mul(const_(2), x)), "x"); // 2*cos(2x)
```

## Integration

```typescript
import { integrate, tryIntegrate } from "@typesugar/symbolic";

// Basic integrals
integrate(pow(x, const_(2)), "x"); // x³/3
integrate(sin(x), "x"); // -cos(x)
integrate(exp(x), "x"); // exp(x)

// Check if integration is possible
const result = tryIntegrate(expr, "x");
if (result.success) {
  console.log(toText(result.result));
} else {
  console.log(`Cannot integrate: ${result.reason}`);
}
```

## Limits

```typescript
import { computeLimit, leftLimit, rightLimit } from "@typesugar/symbolic";

// L'Hôpital's rule is applied when needed
computeLimit(div(sin(x), x), "x", 0); // 1

// One-sided limits
leftLimit(expr, "x", 0);
rightLimit(expr, "x", 0);
```

## Simplification

```typescript
import { simplify, expand, collectTerms } from "@typesugar/symbolic";

// Identity elimination
simplify(add(x, const_(0))); // x
simplify(mul(x, const_(1))); // x
simplify(pow(x, const_(1))); // x

// Constant folding
simplify(add(const_(2), const_(3))); // const_(5)

// Algebraic identities
simplify(sub(x, x)); // 0
simplify(div(x, x)); // 1

// Expand expressions
expand(mul(add(x, const_(1)), add(x, const_(2))));
// x² + 3x + 2

// Collect like terms
collectTerms(add(x, add(x, x)), "x"); // 3x
```

## Pattern Matching

```typescript
import { match, patternVar, rule, rewrite } from "@typesugar/symbolic";

// Create pattern variables
const $a = patternVar("a");
const $b = patternVar("b");

// Match expressions against patterns
const bindings = match(add(const_(1), var_("x")), add($a, $b));
// { a: const_(1), b: var_("x") }

// Create rewrite rules
const commute = rule(add($a, $b), add($b, $a));

// Apply rewrite rules
rewrite(expr, [commute]);
```

## Equation Solving

```typescript
import { solve, solveSystem } from "@typesugar/symbolic";

// Linear equations: 2x + 3 = 7
const result = solve(equation(add(mul(const_(2), x), const_(3)), const_(7)), "x");
// { success: true, solutions: [const_(2)] }

// Quadratic equations: x² - 5x + 6 = 0
const quad = sub(sub(pow(x, const_(2)), mul(const_(5), x)), const_(-6));
solve(quad, "x");
// { success: true, solutions: [const_(3), const_(2)] }

// Systems of equations
solveSystem(
  [
    { left: add(x, y), right: const_(5) },
    { left: sub(x, y), right: const_(1) },
  ],
  ["x", "y"]
);
// Map { "x" => const_(3), "y" => const_(2) }
```

## Typeclass Integration

The package provides a `Numeric<Expression<T>>` typeclass instance for operator overloading:

```typescript
import { numericExpression, numericExpr } from "@typesugar/symbolic";

const N = numericExpr;
const result = N.add(x, N.mul(const_(2), y));
```

When used with the typesugar transformer, operators work naturally:

```typescript
// With transformer: x + 2 * y → add(x, mul(const_(2), y))
const position = const_(0.5) * t * t;
```

## License

MIT
