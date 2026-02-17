/**
 * Zero-Cost Abstractions for typemacro
 *
 * A collection of compile-time macros that provide rich, type-safe APIs
 * that compile away to minimal or zero runtime overhead.
 *
 * ## Abstractions
 *
 * ### Option<T> — Nullable values with monadic API
 * Rich method chains (map, flatMap, filter, match, zip, unwrapOr...)
 * that compile to inlined null checks. No wrapper objects.
 *
 * ### Result<T, E> — Error handling without exceptions
 * Ok/Err discriminated union with method chains (map, mapErr, flatMap,
 * match, unwrapOr...) that compile to inlined .ok property checks.
 *
 * ### Newtype<Base, Brand> — Branded primitives
 * Type-safe wrappers (UserId, Email, Meters...) where wrap/unwrap
 * compile away completely. Zero runtime cost, full type safety.
 *
 * ### pipe() / flow() — Function composition
 * pipe(x, f, g, h) compiles to h(g(f(x))). No arrays, no reduce.
 * flow(f, g, h) compiles to (x) => h(g(f(x))).
 *
 * ### Assertions — Compile-time and runtime checks
 * staticAssert() and typeAssert() erase completely.
 * invariant() compiles to a conditional throw.
 * unreachable() marks impossible code paths.
 * debugOnly() wraps dev-only code that can be stripped.
 * sizeof<T>() returns property count as a literal.
 *
 * ### Pattern Matching — Exhaustive match expressions
 * match() for discriminated unions compiles to if/else chains.
 * matchLiteral() for string/number matching.
 * matchGuard() for predicate-based matching.
 *
 * @example
 * ```typescript
 * import {
 *   Option, Result, pipe, flow, match,
 *   wrap, unwrap, invariant, unreachable,
 *   type Newtype, type Equals,
 * } from "typemacro/zero-cost";
 *
 * // Compose zero-cost abstractions:
 * type UserId = Newtype<number, "UserId">;
 *
 * const result = pipe(
 *   getUserById(wrap<UserId>(42)),          // Result<User, Error>
 *   r => Result.map(r, u => u.email),       // Result<string, Error>
 *   r => Result.unwrapOr(r, "unknown"),     // string
 * );
 * ```
 */

// Option type and macro
export { Option, optionMacro, type Option as OptionType } from "./option.js";

// Result type and macro
export {
  Result,
  resultMacro,
  type Ok,
  type Err,
  type Result as ResultType,
} from "./result.js";

// Newtype pattern
export {
  wrap,
  unwrap,
  newtypeCtor,
  validatedNewtype,
  wrapMacro,
  unwrapMacro,
  newtypeCtorMacro,
  type Newtype,
  type UnwrapNewtype,
} from "./newtype.js";

// Pipe and flow
export { pipe, flow, pipeMacro, flowMacro } from "./pipe.js";

// Assertions
export {
  staticAssert,
  typeAssert,
  invariant,
  unreachable,
  debugOnly,
  sizeof,
  staticAssertMacro,
  typeAssertMacro,
  invariantMacro,
  unreachableMacro,
  debugOnlyMacro,
  sizeofMacro,
  type Equals,
  type Extends,
  type Not,
  type And,
  type Or,
} from "./assert.js";

// Pattern matching
export {
  match,
  matchLiteral,
  matchGuard,
  matchMacro,
  matchLiteralMacro,
  matchGuardMacro,
} from "./match.js";
