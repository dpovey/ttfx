/**
 * Zero-Cost pipe/flow - Inlined function composition
 *
 * pipe() and flow() provide point-free function composition that compiles
 * to direct nested calls — no intermediate arrays, no reduce, no closures.
 *
 * Inspired by fp-ts pipe, Ramda, and F# |> operator.
 *
 * @example
 * ```typescript
 * // Source (what you write):
 * const result = pipe(
 *   rawInput,
 *   trim,
 *   toLowerCase,
 *   x => x.split(","),
 *   xs => xs.filter(Boolean),
 * );
 *
 * // Compiled output (what runs):
 * const result = ((x) => x.filter(Boolean))(
 *   ((x) => x.split(","))(
 *     toLowerCase(
 *       trim(rawInput)
 *     )
 *   )
 * );
 *
 * // With simple named functions, even simpler:
 * const result = pipe(users, filterActive, sortByName, take(10));
 * // Compiles to:
 * const result = take(10)(sortByName(filterActive(users)));
 * ```
 *
 * @example
 * ```typescript
 * // flow() creates a reusable pipeline (compiles to a single composed function):
 * const processUser = flow(
 *   validateEmail,
 *   normalizeCase,
 *   addTimestamp,
 * );
 *
 * // Compiled output:
 * const processUser = (__x) => addTimestamp(normalizeCase(validateEmail(__x)));
 * ```
 */

import * as ts from "typescript";
import { defineExpressionMacro, globalRegistry } from "../../core/registry.js";
import { MacroContext } from "../../core/types.js";

// ============================================================================
// Type-Level API
// ============================================================================

/** pipe: Apply a value through a chain of functions left-to-right */
export function pipe<A>(value: A): A;
export function pipe<A, B>(value: A, f1: (a: A) => B): B;
export function pipe<A, B, C>(value: A, f1: (a: A) => B, f2: (b: B) => C): C;
export function pipe<A, B, C, D>(
  value: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
): D;
export function pipe<A, B, C, D, E>(
  value: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
): E;
export function pipe<A, B, C, D, E, F>(
  value: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => F,
): F;
export function pipe<A, B, C, D, E, F, G>(
  value: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => F,
  f6: (f: F) => G,
): G;
export function pipe<A, B, C, D, E, F, G, H>(
  value: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => F,
  f6: (f: F) => G,
  f7: (g: G) => H,
): H;
export function pipe<A, B, C, D, E, F, G, H, I>(
  value: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => F,
  f6: (f: F) => G,
  f7: (g: G) => H,
  f8: (h: H) => I,
): I;
export function pipe(
  value: unknown,
  ...fns: Array<(x: unknown) => unknown>
): unknown {
  return fns.reduce((acc, fn) => fn(acc), value);
}

/** flow: Compose functions left-to-right into a single function */
export function flow<A, B>(f1: (a: A) => B): (a: A) => B;
export function flow<A, B, C>(f1: (a: A) => B, f2: (b: B) => C): (a: A) => C;
export function flow<A, B, C, D>(
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
): (a: A) => D;
export function flow<A, B, C, D, E>(
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
): (a: A) => E;
export function flow<A, B, C, D, E, F>(
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => F,
): (a: A) => F;
export function flow<A, B, C, D, E, F, G>(
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => F,
  f6: (f: F) => G,
): (a: A) => G;
export function flow(
  ...fns: Array<(x: unknown) => unknown>
): (x: unknown) => unknown {
  return (x) => fns.reduce((acc, fn) => fn(acc), x);
}

// ============================================================================
// Pipe Macro - Inlines function composition
// ============================================================================

export const pipeMacro = defineExpressionMacro({
  name: "pipe",
  description:
    "Zero-cost pipe — inlines function composition into nested calls",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    const factory = ctx.factory;

    if (args.length === 0) {
      ctx.reportError(callExpr, "pipe() requires at least one argument");
      return callExpr;
    }

    if (args.length === 1) {
      // pipe(x) => x
      return args[0];
    }

    // pipe(value, f1, f2, f3) => f3(f2(f1(value)))
    let result: ts.Expression = args[0];
    for (let i = 1; i < args.length; i++) {
      result = factory.createCallExpression(args[i], undefined, [result]);
    }
    return result;
  },
});

// ============================================================================
// Flow Macro - Composes functions into a single arrow
// ============================================================================

export const flowMacro = defineExpressionMacro({
  name: "flow",
  description:
    "Zero-cost flow — composes functions into a single inlined arrow function",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    const factory = ctx.factory;

    if (args.length === 0) {
      ctx.reportError(callExpr, "flow() requires at least one function");
      return callExpr;
    }

    if (args.length === 1) {
      // flow(f) => f
      return args[0];
    }

    // flow(f1, f2, f3) => (__x) => f3(f2(f1(__x)))
    const param = ctx.generateUniqueName("__x");
    let body: ts.Expression = param;
    for (const fn of args) {
      body = factory.createCallExpression(fn, undefined, [body]);
    }

    return factory.createArrowFunction(
      undefined,
      undefined,
      [factory.createParameterDeclaration(undefined, undefined, param)],
      undefined,
      factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      body,
    );
  },
});

globalRegistry.register(pipeMacro);
globalRegistry.register(flowMacro);
