/**
 * Zero-Cost Result<T, E> - Compiles to discriminated union checks
 *
 * Result<T, E> represents either success (Ok<T>) or failure (Err<E>).
 * The macro inlines all method chains into direct property access and
 * conditional checks — no wrapper classes, no allocations.
 *
 * The runtime representation is a plain object: { ok: true, value: T } | { ok: false, error: E }
 * The macro compiles away all method calls into direct field access.
 *
 * @example
 * ```typescript
 * // Source (what you write):
 * const parsed = Result.try(() => JSON.parse(input))
 *   .map(data => data.name)
 *   .mapErr(e => `Parse failed: ${e.message}`)
 *   .unwrapOr("unknown");
 *
 * // Compiled output (what runs):
 * let __res_0;
 * try { __res_0 = { ok: true, value: JSON.parse(input) }; }
 * catch (__e) { __res_0 = { ok: false, error: __e }; }
 * const __res_1 = __res_0.ok ? { ok: true, value: __res_0.value.name } : __res_0;
 * const __res_2 = __res_1.ok ? __res_1 : { ok: false, error: `Parse failed: ${__res_1.error.message}` };
 * const parsed = __res_2.ok ? __res_2.value : "unknown";
 * ```
 */

import * as ts from "typescript";
import { defineExpressionMacro, globalRegistry } from "@ttfx/core";
import { MacroContext } from "@ttfx/core";

// ============================================================================
// Type-Level API
// ============================================================================

/** A successful result */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/** A failed result */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/** Discriminated union of Ok and Err */
export type Result<T, E> = Ok<T> | Err<E>;

/** Result namespace with constructors */
export const Result = {
  /** Create a successful result */
  ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
  },

  /** Create a failed result */
  err<E>(error: E): Result<never, E> {
    return { ok: false, error };
  },

  /** Wrap a throwing function into a Result */
  try<T>(fn: () => T): Result<T, Error> {
    try {
      return { ok: true, value: fn() };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e : new Error(String(e)),
      };
    }
  },

  /** Wrap a Promise into a Result */
  async fromPromise<T>(promise: Promise<T>): Promise<Result<T, Error>> {
    try {
      return { ok: true, value: await promise };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e : new Error(String(e)),
      };
    }
  },

  /** Check if a Result is Ok */
  isOk<T, E>(result: Result<T, E>): result is Ok<T> {
    return result.ok;
  },

  /** Check if a Result is Err */
  isErr<T, E>(result: Result<T, E>): result is Err<E> {
    return !result.ok;
  },

  /** Collect an array of Results into a Result of array */
  all<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];
    for (const r of results) {
      if (!r.ok) return r;
      values.push(r.value);
    }
    return { ok: true, value: values };
  },
} as const;

// ============================================================================
// Chain Step Types
// ============================================================================

interface ResultChainStep {
  kind:
    | "ok"
    | "err"
    | "try"
    | "map"
    | "mapErr"
    | "flatMap"
    | "unwrapOr"
    | "unwrap"
    | "unwrapErr"
    | "match"
    | "and"
    | "or"
    | "tap"
    | "tapErr"
    | "isOk"
    | "isErr";
  args: readonly ts.Expression[];
}

// ============================================================================
// Result Macro
// ============================================================================

function parseResultChain(
  node: ts.Expression,
): { root: ts.Expression; steps: ResultChainStep[] } | null {
  const steps: ResultChainStep[] = [];
  let current = node;

  const validMethods = [
    "map",
    "mapErr",
    "flatMap",
    "unwrapOr",
    "unwrap",
    "unwrapErr",
    "match",
    "and",
    "or",
    "tap",
    "tapErr",
    "isOk",
    "isErr",
  ];

  while (ts.isCallExpression(current)) {
    const expr = current.expression;
    if (!ts.isPropertyAccessExpression(expr)) break;

    const methodName = expr.name.text;
    if (!validMethods.includes(methodName)) break;

    steps.unshift({
      kind: methodName as ResultChainStep["kind"],
      args: current.arguments,
    });
    current = expr.expression;
  }

  // Check for Result.ok(...), Result.err(...), Result.try(...)
  if (ts.isCallExpression(current)) {
    const expr = current.expression;
    if (
      ts.isPropertyAccessExpression(expr) &&
      ts.isIdentifier(expr.expression) &&
      expr.expression.text === "Result"
    ) {
      const method = expr.name.text;
      if (method === "ok" || method === "err" || method === "try") {
        steps.unshift({
          kind: method as ResultChainStep["kind"],
          args: current.arguments,
        });
        return { root: current, steps };
      }
    }
  }

  if (steps.length === 0) return null;
  return { root: current, steps };
}

function expandResultChain(
  ctx: MacroContext,
  chain: { root: ts.Expression; steps: ResultChainStep[] },
): ts.Expression {
  const factory = ctx.factory;

  function okObj(value: ts.Expression): ts.Expression {
    return factory.createObjectLiteralExpression([
      factory.createPropertyAssignment("ok", factory.createTrue()),
      factory.createPropertyAssignment("value", value),
    ]);
  }

  function errObj(error: ts.Expression): ts.Expression {
    return factory.createObjectLiteralExpression([
      factory.createPropertyAssignment("ok", factory.createFalse()),
      factory.createPropertyAssignment("error", error),
    ]);
  }

  function okCheck(
    result: ts.Expression,
    thenExpr: ts.Expression,
    elseExpr: ts.Expression,
  ): ts.Expression {
    return factory.createConditionalExpression(
      factory.createPropertyAccessExpression(result, "ok"),
      factory.createToken(ts.SyntaxKind.QuestionToken),
      thenExpr,
      factory.createToken(ts.SyntaxKind.ColonToken),
      elseExpr,
    );
  }

  let currentExpr: ts.Expression | null = null;

  for (const step of chain.steps) {
    switch (step.kind) {
      case "ok": {
        // Result.ok(x) => { ok: true, value: x }
        currentExpr = okObj(step.args[0]);
        break;
      }

      case "err": {
        // Result.err(e) => { ok: false, error: e }
        currentExpr = errObj(step.args[0]);
        break;
      }

      case "try": {
        // Result.try(fn) => try { { ok: true, value: fn() } } catch(e) { { ok: false, error: e } }
        const fn = step.args[0];
        const tempErr = ctx.generateUniqueName("__e");
        // We emit an IIFE with try/catch
        currentExpr = factory.createCallExpression(
          factory.createParenthesizedExpression(
            factory.createArrowFunction(
              undefined,
              undefined,
              [],
              undefined,
              factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
              factory.createBlock([
                factory.createTryStatement(
                  factory.createBlock([
                    factory.createReturnStatement(
                      okObj(factory.createCallExpression(fn, undefined, [])),
                    ),
                  ]),
                  factory.createCatchClause(
                    factory.createVariableDeclaration(tempErr),
                    factory.createBlock([
                      factory.createReturnStatement(errObj(tempErr)),
                    ]),
                  ),
                  undefined,
                ),
              ]),
            ),
          ),
          undefined,
          [],
        );
        break;
      }

      case "map": {
        // .map(f) => r.ok ? { ok: true, value: f(r.value) } : r
        const fn = step.args[0];
        const prev = currentExpr!;
        const valueAccess = factory.createPropertyAccessExpression(
          prev,
          "value",
        );
        const mapped = factory.createCallExpression(fn, undefined, [
          valueAccess,
        ]);
        currentExpr = okCheck(prev, okObj(mapped), prev);
        break;
      }

      case "mapErr": {
        // .mapErr(f) => r.ok ? r : { ok: false, error: f(r.error) }
        const fn = step.args[0];
        const prev = currentExpr!;
        const errorAccess = factory.createPropertyAccessExpression(
          prev,
          "error",
        );
        const mapped = factory.createCallExpression(fn, undefined, [
          errorAccess,
        ]);
        currentExpr = okCheck(prev, prev, errObj(mapped));
        break;
      }

      case "flatMap": {
        // .flatMap(f) => r.ok ? f(r.value) : r
        const fn = step.args[0];
        const prev = currentExpr!;
        const valueAccess = factory.createPropertyAccessExpression(
          prev,
          "value",
        );
        const chained = factory.createCallExpression(fn, undefined, [
          valueAccess,
        ]);
        currentExpr = okCheck(prev, chained, prev);
        break;
      }

      case "unwrapOr": {
        // .unwrapOr(default) => r.ok ? r.value : default
        const defaultVal = step.args[0];
        const prev = currentExpr!;
        const valueAccess = factory.createPropertyAccessExpression(
          prev,
          "value",
        );
        currentExpr = okCheck(prev, valueAccess, defaultVal);
        break;
      }

      case "unwrap": {
        // .unwrap() => r.ok ? r.value : throw r.error
        const prev = currentExpr!;
        const valueAccess = factory.createPropertyAccessExpression(
          prev,
          "value",
        );
        currentExpr = okCheck(
          prev,
          valueAccess,
          factory.createCallExpression(
            factory.createParenthesizedExpression(
              factory.createArrowFunction(
                undefined,
                undefined,
                [],
                undefined,
                factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                factory.createBlock([
                  factory.createThrowStatement(
                    factory.createPropertyAccessExpression(prev, "error"),
                  ),
                ]),
              ),
            ),
            undefined,
            [],
          ),
        );
        break;
      }

      case "unwrapErr": {
        // .unwrapErr() => r.ok ? throw "Expected Err" : r.error
        const prev = currentExpr!;
        const errorAccess = factory.createPropertyAccessExpression(
          prev,
          "error",
        );
        currentExpr = okCheck(
          prev,
          factory.createCallExpression(
            factory.createParenthesizedExpression(
              factory.createArrowFunction(
                undefined,
                undefined,
                [],
                undefined,
                factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                factory.createBlock([
                  factory.createThrowStatement(
                    factory.createNewExpression(
                      factory.createIdentifier("Error"),
                      undefined,
                      [factory.createStringLiteral("Called unwrapErr() on Ok")],
                    ),
                  ),
                ]),
              ),
            ),
            undefined,
            [],
          ),
          errorAccess,
        );
        break;
      }

      case "match": {
        // .match({ ok: f, err: g }) or .match(okFn, errFn)
        const prev = currentExpr!;
        if (step.args.length === 2) {
          const okFn = step.args[0];
          const errFn = step.args[1];
          const valueAccess = factory.createPropertyAccessExpression(
            prev,
            "value",
          );
          const errorAccess = factory.createPropertyAccessExpression(
            prev,
            "error",
          );
          currentExpr = okCheck(
            prev,
            factory.createCallExpression(okFn, undefined, [valueAccess]),
            factory.createCallExpression(errFn, undefined, [errorAccess]),
          );
        } else if (
          step.args.length === 1 &&
          ts.isObjectLiteralExpression(step.args[0])
        ) {
          const obj = step.args[0];
          let okFn: ts.Expression | undefined;
          let errFn: ts.Expression | undefined;
          for (const prop of obj.properties) {
            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
              if (prop.name.text === "ok") okFn = prop.initializer;
              if (prop.name.text === "err") errFn = prop.initializer;
            }
          }
          if (okFn && errFn) {
            const valueAccess = factory.createPropertyAccessExpression(
              prev,
              "value",
            );
            const errorAccess = factory.createPropertyAccessExpression(
              prev,
              "error",
            );
            currentExpr = okCheck(
              prev,
              factory.createCallExpression(okFn, undefined, [valueAccess]),
              factory.createCallExpression(errFn, undefined, [errorAccess]),
            );
          }
        }
        break;
      }

      case "and": {
        // .and(other) => r.ok ? other : r
        const other = step.args[0];
        const prev = currentExpr!;
        currentExpr = okCheck(prev, other, prev);
        break;
      }

      case "or": {
        // .or(other) => r.ok ? r : other
        const other = step.args[0];
        const prev = currentExpr!;
        currentExpr = okCheck(prev, prev, other);
        break;
      }

      case "tap": {
        // .tap(f) => (r.ok && f(r.value), r)
        const fn = step.args[0];
        const prev = currentExpr!;
        const valueAccess = factory.createPropertyAccessExpression(
          prev,
          "value",
        );
        currentExpr = factory.createParenthesizedExpression(
          factory.createCommaListExpression([
            factory.createBinaryExpression(
              factory.createPropertyAccessExpression(prev, "ok"),
              factory.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
              factory.createCallExpression(fn, undefined, [valueAccess]),
            ),
            prev,
          ]),
        );
        break;
      }

      case "tapErr": {
        // .tapErr(f) => (!r.ok && f(r.error), r)
        const fn = step.args[0];
        const prev = currentExpr!;
        const errorAccess = factory.createPropertyAccessExpression(
          prev,
          "error",
        );
        currentExpr = factory.createParenthesizedExpression(
          factory.createCommaListExpression([
            factory.createBinaryExpression(
              factory.createPrefixUnaryExpression(
                ts.SyntaxKind.ExclamationToken,
                factory.createPropertyAccessExpression(prev, "ok"),
              ),
              factory.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
              factory.createCallExpression(fn, undefined, [errorAccess]),
            ),
            prev,
          ]),
        );
        break;
      }

      case "isOk": {
        // .isOk() => r.ok
        const prev = currentExpr!;
        currentExpr = factory.createPropertyAccessExpression(prev, "ok");
        break;
      }

      case "isErr": {
        // .isErr() => !r.ok
        const prev = currentExpr!;
        currentExpr = factory.createPrefixUnaryExpression(
          ts.SyntaxKind.ExclamationToken,
          factory.createPropertyAccessExpression(prev, "ok"),
        );
        break;
      }
    }
  }

  return currentExpr ?? chain.root;
}

// ============================================================================
// Register
// ============================================================================

export const resultMacro = defineExpressionMacro({
  name: "Result",
  description:
    "Zero-cost Result type — compiles method chains to inlined ok/error checks",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    const chain = parseResultChain(callExpr);
    if (chain) {
      return expandResultChain(ctx, chain);
    }

    // Handle standalone Result.ok / Result.err
    const expr = callExpr.expression;
    if (
      ts.isPropertyAccessExpression(expr) &&
      ts.isIdentifier(expr.expression) &&
      expr.expression.text === "Result"
    ) {
      const method = expr.name.text;
      const factory = ctx.factory;

      if (method === "ok" && args.length === 1) {
        return factory.createObjectLiteralExpression([
          factory.createPropertyAssignment("ok", factory.createTrue()),
          factory.createPropertyAssignment("value", args[0]),
        ]);
      }

      if (method === "err" && args.length === 1) {
        return factory.createObjectLiteralExpression([
          factory.createPropertyAssignment("ok", factory.createFalse()),
          factory.createPropertyAssignment("error", args[0]),
        ]);
      }

      if (method === "isOk" && args.length === 1) {
        return factory.createPropertyAccessExpression(args[0], "ok");
      }

      if (method === "isErr" && args.length === 1) {
        return factory.createPrefixUnaryExpression(
          ts.SyntaxKind.ExclamationToken,
          factory.createPropertyAccessExpression(args[0], "ok"),
        );
      }
    }

    return callExpr;
  },
});

globalRegistry.register(resultMacro);
