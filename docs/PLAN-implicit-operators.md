# Plan: Typeclass-Based Operator Overloading (Revised)

## The Cats/Scala Model

After studying Cats, here's how it actually works:

```scala
// 1. Typeclass - JUST the interface, no operators
trait Semigroup[A] {
  def combine(a: A, b: A): A
}

// 2. Syntax - SEPARATELY defines operators as extensions that REQUIRE a typeclass
// (in cats/syntax/semigroup.scala)
final class SemigroupOps[A: Semigroup](lhs: A) {  // Note: requires Semigroup[A]
  def |+|(rhs: A): A = Semigroup[A].combine(lhs, rhs)
}

// 3. Instance - implementation for a specific type
given Semigroup[List[Int]] with
  def combine(a: List[Int], b: List[Int]) = a ++ b

// 4. Usage - operator works because instance exists
List(1, 2) |+| List(3, 4)  // Works! Semigroup[List[Int]] exists
```

**The key**: Syntax is an extension method that REQUIRES a typeclass instance. The operator doesn't "belong" to the typeclass - it's a syntactic convenience that calls the typeclass method IF an instance can be summoned.

## Zero-Cost Abstraction

The key insight: at compile time we KNOW everything:

1. Which operator is being used
2. The type of the operands
3. Which typeclass provides the syntax for that operator
4. Which instance exists for that type
5. The body of the instance's method

So instead of generating runtime lookups, we **inline directly**:

```typescript
// Source:
[1, 2] + [3, 4]

// BAD (runtime cost): Map lookup + indirect call
Semigroup.summon<Array>("Array").concat([1,2], [3,4])

// GOOD (one indirection): Direct instance reference
arraySemigroup.concat([1,2], [3,4])

// BEST (zero-cost): Inline the method body
[...[1,2], ...[3,4]]
```

The existing `specialize` macro already does this for functions. We reuse `inlineMethod()` from `specialize.ts` for operators.

## ttfx Model

### Option A: Syntax Declared in Typeclass (Simpler)

```typescript
// Typeclass declares which operators map to which methods
// This is metadata, not part of the interface contract
@typeclass
interface Semigroup<A> {
  concat(a: A, b: A): A;

  // Syntax declaration - says "+" can be used to call concat
  static syntax = { "+": "concat" };
}

// Instance - just implements the methods
@instance
const arraySemigroup: Semigroup<Array<unknown>> = {
  concat: (a, b) => [...a, ...b],
};

// Usage - + works because:
// 1. Syntax says + → Semigroup.concat
// 2. Semigroup instance exists for Array
[1, 2] + [3, 4]  // → Semigroup.summon<Array>("Array").concat([1,2], [3,4])
```

### Option B: Syntax Declared Separately (More Like Cats)

```typescript
// Typeclass - pure interface
@typeclass
interface Semigroup<A> {
  concat(a: A, b: A): A;
}

// Syntax - separately declares operator mappings
// Only active when imported
@syntax(Semigroup, { "+": "concat" })

// Or as a function:
declareSyntax(Semigroup, "+", "concat");

// Instance
@instance
const arraySemigroup: Semigroup<Array<unknown>> = {
  concat: (a, b) => [...a, ...b],
};

// Usage
import { semigroupSyntax } from "@ttfx/syntax";  // Must import syntax!
[1, 2] + [3, 4]
```

### Option C: Extension Methods with Typeclass Constraint

This is closest to Scala 3:

```typescript
// Typeclass
@typeclass
interface Semigroup<A> {
  concat(a: A, b: A): A;
}

// Extension method that requires Semigroup instance
// The "+" is just the extension method name (but we can't use symbols in TS)
@extension(Semigroup)
function concat<A>(self: A, other: A): A {
  return summon<Semigroup<A>>().concat(self, other);
}

// Operator mapping is separate
@operatorSyntax({ "+": { typeclass: Semigroup, method: "concat" } })

// Usage
[1, 2] + [3, 4]
// Transformer sees: + operator, Array type
// Checks: is there syntax for + that requires a typeclass?
// Yes: + requires Semigroup with method concat
// Checks: is there a Semigroup instance for Array?
// Yes!
// Rewrites to: Semigroup.summon<Array>("Array").concat([1,2], [3,4])
```

## Which Comes First?

**Question**: When we see `a + b`, how do we know what to do?

**Answer** (Cats model):

1. Look up: is there syntax that maps `+` to some typeclass method?
2. If yes: which typeclass and method?
3. Check: does an instance of that typeclass exist for `typeof a`?
4. If yes: rewrite to `TC.summon<T>("T").method(a, b)`

So the lookup is:

```
Operator → Syntax mapping → Typeclass + Method → Instance check → Rewrite
```

## Proposed Design (Option A - Simpler)

Keep it simple: syntax is declared in the typeclass, but it's just metadata about how operators map to methods.

### TypeclassInfo Extension

```typescript
interface TypeclassInfo {
  name: string;
  typeParam: string;
  methods: TypeclassMethod[];
  canDeriveProduct: boolean;
  canDeriveSum: boolean;
  syntax?: Map<string, string>; // operator → method name
}
```

### Global Syntax Registry

```typescript
// Maps: operator → array of { typeclass, method }
// Multiple typeclasses might use the same operator
const syntaxRegistry = new Map<
  string,
  Array<{ typeclass: string; method: string }>
>();

// When a typeclass with syntax is registered:
function registerTypeclassSyntax(tcName: string, syntax: Map<string, string>) {
  for (const [op, method] of syntax) {
    let entries = syntaxRegistry.get(op);
    if (!entries) {
      entries = [];
      syntaxRegistry.set(op, entries);
    }
    entries.push({ typeclass: tcName, method });
  }
}
```

### Transformer Logic (Zero-Cost via Inlining)

```typescript
private tryRewriteTypeclassOperator(node: ts.BinaryExpression): ts.Expression | undefined {
  const operator = getOperatorString(node.operatorToken.kind);
  if (!operator) return undefined;

  // Skip primitives
  const leftType = this.ctx.typeChecker.getTypeAtLocation(node.left);
  if (this.isPrimitiveType(leftType)) return undefined;

  const typeName = this.ctx.typeChecker.typeToString(leftType);
  const baseTypeName = typeName.replace(/<.*>$/, "");

  // Find syntax mappings for this operator
  const syntaxEntries = syntaxRegistry.get(operator);
  if (!syntaxEntries || syntaxEntries.length === 0) return undefined;

  // Check each typeclass that uses this operator
  for (const { typeclass, method } of syntaxEntries) {
    // Does an instance exist for this type?
    const instance = findInstance(typeclass, baseTypeName)
                  || findInstance(typeclass, typeName);

    if (instance) {
      // Get the method's implementation from the registered instance
      const methodInfo = getInstanceMethods(instance.name);  // From specialize.ts
      const methodImpl = methodInfo?.methods.get(method);

      const left = ts.visitNode(node.left, this.boundVisit) as ts.Expression;
      const right = ts.visitNode(node.right, this.boundVisit) as ts.Expression;

      if (methodImpl) {
        // ZERO-COST: Inline the method body directly
        // a + b → [...a, ...b]  (if concat = (a, b) => [...a, ...b])
        return inlineMethod(this.ctx, methodImpl, [left, right]);
      } else {
        // Fallback: Direct instance reference (one indirection, still fast)
        // a + b → arraySemigroup.concat(a, b)
        return this.ctx.factory.createCallExpression(
          this.ctx.factory.createPropertyAccessExpression(
            this.ctx.factory.createIdentifier(instance.name),
            method
          ),
          undefined,
          [left, right]
        );
      }
    }
  }

  return undefined;
}
```

## Standard Typeclasses with Syntax

```typescript
@typeclass
interface Semigroup<A> {
  concat(a: A, b: A): A;
  static syntax = { "+": "concat" };
}

@typeclass
interface Num<A> {
  add(a: A, b: A): A;
  sub(a: A, b: A): A;
  mul(a: A, b: A): A;
  static syntax = { "+": "add", "-": "sub", "*": "mul" };
}

@typeclass
interface Eq<A> {
  eq(a: A, b: A): boolean;
  neq(a: A, b: A): boolean;
  static syntax = { "==": "eq", "!=": "neq" };
}

@typeclass
interface Ord<A> extends Eq<A> {
  compare(a: A, b: A): -1 | 0 | 1;
  lt(a: A, b: A): boolean;
  gt(a: A, b: A): boolean;
  static syntax = { "<": "lt", ">": "gt", "<=": "lte", ">=": "gte" };
}

@typeclass
interface Bind<F> {
  bind<A, B>(fa: Kind<F, A>, f: (a: A) => Kind<F, B>): Kind<F, B>;
  static syntax = { ">>": "bind" };  // Repurpose right-shift for monadic bind
}
```

## Example: Multiple Typeclasses for Same Operator

What if both `Num` and `Semigroup` define `+`?

```typescript
// Num uses + for numeric addition
@typeclass
interface Num<A> {
  add(a: A, b: A): A;
  static syntax = { "+": "add" };
}

// Semigroup uses + for concatenation
@typeclass
interface Semigroup<A> {
  concat(a: A, b: A): A;
  static syntax = { "+": "concat" };
}

// Vec2 has Num instance
@instance const vec2Num: Num<Vec2> = { add: ... };

// Array has Semigroup instance
@instance const arraySemigroup: Semigroup<Array<unknown>> = { concat: ... };

// Usage:
vec1 + vec2  // → Num.summon<Vec2>("Vec2").add(vec1, vec2)
[1,2] + [3,4]  // → Semigroup.summon<Array>("Array").concat([1,2], [3,4])
```

The transformer tries each typeclass that defines `+` until one has a matching instance.

## Conflict Resolution

What if a type has BOTH `Num` and `Semigroup` instances?

```typescript
// Both define +
@instance const fooNum: Num<Foo> = { add: ... };
@instance const fooSemigroup: Semigroup<Foo> = { concat: ... };

foo1 + foo2  // Which one wins?
```

**Options**:

1. First registered wins (order-dependent - bad)
2. Compile error: ambiguous operator (safe)
3. Explicit precedence: `Num` > `Semigroup` (opinionated)
4. User must disambiguate: `summon<Num<Foo>>().add(foo1, foo2)`

**Recommendation**: Option 2 - compile error with helpful message.

## Migration from `@operators`

The existing `@operators` decorator becomes syntactic sugar:

```typescript
// This:
@operators({ "+": "add" })
class Vec2 { add(other: Vec2): Vec2 { ... } }

// Becomes equivalent to:
@typeclass
interface Vec2Ops<A> {
  add(a: A, b: A): A;
  static syntax = { "+": "add" };
}

@instance
const vec2Ops: Vec2Ops<Vec2> = {
  add: (a, b) => a.add(b),  // Delegates to instance method
};
```

## Tasks

- [ ] Add `syntax?: Map<string, string>` to `TypeclassInfo`
- [ ] Create `syntaxRegistry` for operator→typeclass lookups
- [ ] Parse `static syntax = { ... }` in `@typeclass` decorator
- [ ] Register syntax when typeclass is defined
- [ ] Implement `tryRewriteTypeclassOperator()` in transformer
- [ ] Handle operator precedence / conflict detection
- [ ] Define standard typeclasses: `Semigroup`, `Num`, `Eq`, `Ord`, `Bind`
- [ ] Update `@operators` to be sugar for typeclass+instance
- [ ] Add tests for all scenarios
- [ ] Update documentation

## Zero-Cost Levels

| Level           | Output                               | Runtime Cost      | When Used                         |
| --------------- | ------------------------------------ | ----------------- | --------------------------------- |
| **Full inline** | `[...a, ...b]`                       | None              | Method body is simple expression  |
| **Direct call** | `arraySemigroup.concat(a, b)`        | 1 function call   | Method body too complex to inline |
| **Summon call** | `Semigroup.summon(...).concat(a, b)` | Map lookup + call | Fallback if instance not known    |

The transformer prefers higher levels. Most simple methods (like array concat, vector add) will fully inline.

## Open Questions

1. **Conflict resolution**: Error on ambiguity, or defined precedence?

2. **Import-gating**: Should syntax only work when the typeclass is imported? (More like Cats, more explicit)

3. **Right-operand fallback**: If `3 * vec` doesn't match (left is primitive), should we check right operand?

4. **Method vs function signature**: Should `add(a, b)` or `add(other)` style methods be preferred? Cats uses `(a, b)` style.
