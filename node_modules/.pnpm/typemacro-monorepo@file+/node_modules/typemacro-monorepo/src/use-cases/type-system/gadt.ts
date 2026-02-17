/**
 * Generalized Algebraic Data Types (GADTs) Macro
 *
 * TypeScript's discriminated unions can narrow the discriminant, but they
 * cannot narrow type parameters. GADTs allow each variant of a union to
 * constrain the type parameter differently.
 *
 * This is essential for:
 * - Type-safe expression evaluators
 * - Type-safe protocol encodings
 * - Type-safe state machines
 * - Proof-carrying code
 *
 * ## The Problem
 *
 * ```typescript
 * // TypeScript can't express this:
 * type Expr<A> =
 *   | { tag: "num"; value: number }       // When tag is "num", A must be number
 *   | { tag: "bool"; value: boolean }     // When tag is "bool", A must be boolean
 *   | { tag: "add"; left: Expr<number>; right: Expr<number> }; // A must be number
 *
 * // When you match on tag, TypeScript doesn't know that A is narrowed:
 * function eval<A>(expr: Expr<A>): A {
 *   switch (expr.tag) {
 *     case "num": return expr.value;  // Error: number is not A
 *   }
 * }
 * ```
 *
 * ## The Solution
 *
 * ```typescript
 * // Define a GADT with the macro:
 * const Expr = gadt<{
 *   Num: { value: number };                              // Expr<number>
 *   Bool: { value: boolean };                            // Expr<boolean>
 *   Add: { left: Expr<number>; right: Expr<number> };   // Expr<number>
 *   If: { cond: Expr<boolean>; then: Expr<A>; else: Expr<A> }; // Expr<A>
 * }>();
 *
 * // The macro generates smart constructors and a type-safe match:
 * const expr = Expr.Num(42);
 * const result = Expr.match(expr, {
 *   Num: ({ value }) => value,           // TypeScript knows: returns number
 *   Bool: ({ value }) => value,          // TypeScript knows: returns boolean
 *   Add: ({ left, right }) => eval(left) + eval(right),
 *   If: ({ cond, then, else_ }) => eval(cond) ? eval(then) : eval(else_),
 * });
 * ```
 */

import * as ts from "typescript";
import { defineExpressionMacro, globalRegistry } from "../../core/registry.js";
import { MacroContext } from "../../core/types.js";

// ============================================================================
// Type-Level API
// ============================================================================

/** Brand for GADT variant tagging */
declare const __gadt_tag__: unique symbol;
declare const __gadt_result__: unique symbol;

/**
 * A GADT variant — carries its tag and the result type it constrains.
 */
export type GADTVariant<Tag extends string, Fields, Result> = Fields & {
  readonly [__gadt_tag__]: Tag;
  readonly [__gadt_result__]: Result;
};

/**
 * Extract the result type from a GADT variant.
 */
export type GADTResult<V> =
  V extends GADTVariant<string, unknown, infer R> ? R : never;

/**
 * A GADT definition — maps variant names to their fields and result types.
 */
export type GADTDef<Variants extends Record<string, { __result__: unknown }>> =
  {
    [K in keyof Variants]: GADTVariant<
      K & string,
      Omit<Variants[K], "__result__">,
      Variants[K]["__result__"]
    >;
  }[keyof Variants];

/**
 * Match arms for a GADT — each arm receives the fields and must return
 * a value consistent with the variant's result type.
 */
export type GADTMatch<
  Variants extends Record<string, { __result__: unknown }>,
  R,
> = {
  [K in keyof Variants]: (fields: Omit<Variants[K], "__result__">) => R;
};

// ============================================================================
// GADT Runtime Implementation
// ============================================================================

/**
 * A GADT value at runtime — just a tagged object.
 */
export interface GADTValue<Tag extends string = string> {
  readonly __tag: Tag;
  readonly [key: string]: unknown;
}

/**
 * Create a GADT definition with smart constructors and pattern matching.
 *
 * @param variants - Object mapping variant names to their field types
 * @returns An object with constructors for each variant and a `match` function
 *
 * @example
 * ```typescript
 * interface ExprVariants {
 *   Lit: { value: number; __result__: number };
 *   Bool: { value: boolean; __result__: boolean };
 *   Add: { left: Expr; right: Expr; __result__: number };
 *   If: { cond: Expr; then_: Expr; else_: Expr; __result__: unknown };
 * }
 *
 * type Expr = GADTDef<ExprVariants>;
 *
 * const Expr = createGADT<ExprVariants>({
 *   Lit: ["value"],
 *   Bool: ["value"],
 *   Add: ["left", "right"],
 *   If: ["cond", "then_", "else_"],
 * });
 *
 * const e = Expr.Lit({ value: 42 });
 * const result = Expr.match(e, {
 *   Lit: ({ value }) => value,
 *   Bool: ({ value }) => value,
 *   Add: ({ left, right }) => evalExpr(left) + evalExpr(right),
 *   If: ({ cond, then_, else_ }) =>
 *     evalExpr(cond) ? evalExpr(then_) : evalExpr(else_),
 * });
 * ```
 */
export function createGADT<
  Variants extends Record<string, Record<string, unknown>>,
>(variantFields: {
  [K in keyof Variants]: (keyof Omit<Variants[K], "__result__">)[];
}): GADTModule<Variants> {
  const constructors: Record<string, Function> = {};
  const variantNames = Object.keys(variantFields);

  for (const name of variantNames) {
    constructors[name] = (fields: Record<string, unknown>) => ({
      __tag: name,
      ...fields,
    });
  }

  const matchFn = <R>(
    value: GADTValue,
    arms: Record<string, (fields: Record<string, unknown>) => R>,
  ): R => {
    const arm = arms[value.__tag];
    if (!arm) {
      throw new Error(`Non-exhaustive match: missing case '${value.__tag}'`);
    }
    return arm(value);
  };

  const matchPartialFn = <R>(
    value: GADTValue,
    arms: Record<string, ((fields: Record<string, unknown>) => R) | undefined>,
    otherwise: (value: GADTValue) => R,
  ): R => {
    const arm = arms[value.__tag];
    if (arm) {
      return arm(value);
    }
    return otherwise(value);
  };

  const isFn = <K extends string>(value: GADTValue, tag: K): boolean => {
    return value.__tag === tag;
  };

  return {
    ...constructors,
    match: matchFn,
    matchPartial: matchPartialFn,
    is: isFn,
    variants: variantNames,
  } as unknown as GADTModule<Variants>;
}

/**
 * The module type returned by createGADT — contains constructors,
 * match, and utility functions.
 */
export type GADTModule<
  Variants extends Record<string, Record<string, unknown>>,
> = {
  /** Smart constructors — one for each variant */
  [K in keyof Variants]: (
    fields: Omit<Variants[K], "__result__">,
  ) => GADTValue<K & string>;
} & {
  /** Exhaustive pattern match */
  match: <R>(
    value: GADTValue,
    arms: {
      [K in keyof Variants]: (fields: Omit<Variants[K], "__result__">) => R;
    },
  ) => R;

  /** Partial pattern match with default */
  matchPartial: <R>(
    value: GADTValue,
    arms: {
      [K in keyof Variants]?: (fields: Omit<Variants[K], "__result__">) => R;
    },
    otherwise: (value: GADTValue) => R,
  ) => R;

  /** Type guard for a specific variant */
  is: <K extends keyof Variants & string>(
    value: GADTValue,
    tag: K,
  ) => value is GADTValue<K>;

  /** List of variant names */
  variants: (keyof Variants & string)[];
};

// ============================================================================
// GADT Expression Macro
// ============================================================================

/**
 * gadt macro — creates a GADT module from a variant definition.
 *
 * At compile time, this macro:
 * 1. Reads the type argument to extract variant definitions
 * 2. Generates smart constructors for each variant
 * 3. Generates a type-safe exhaustive match function
 * 4. Generates type guards for each variant
 */
export const gadtMacro = defineExpressionMacro({
  name: "gadt",
  description: "Create a GADT with smart constructors and exhaustive matching",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    // If called with an argument (the variant fields object), pass through
    // to createGADT at runtime
    if (args.length >= 1) {
      const factory = ctx.factory;
      return factory.createCallExpression(
        factory.createIdentifier("createGADT"),
        callExpr.typeArguments,
        [args[0]],
      );
    }

    // If called without arguments, try to extract variant info from type args
    // and generate the fields object automatically
    if (callExpr.typeArguments && callExpr.typeArguments.length > 0) {
      const typeArg = callExpr.typeArguments[0];
      const type = ctx.typeChecker.getTypeFromTypeNode(typeArg);
      const properties = ctx.typeChecker.getPropertiesOfType(type);

      const factory = ctx.factory;
      const variantEntries: ts.PropertyAssignment[] = [];

      for (const prop of properties) {
        const propName = prop.name;
        const declarations = prop.getDeclarations();
        if (!declarations || declarations.length === 0) continue;

        const decl = declarations[0];
        const propType = ctx.typeChecker.getTypeOfSymbolAtLocation(prop, decl);
        const fieldProps = ctx.typeChecker.getPropertiesOfType(propType);

        // Get field names (excluding __result__)
        const fieldNames = fieldProps
          .filter((f) => f.name !== "__result__")
          .map((f) => f.name);

        variantEntries.push(
          factory.createPropertyAssignment(
            factory.createIdentifier(propName),
            factory.createArrayLiteralExpression(
              fieldNames.map((n) => factory.createStringLiteral(n)),
            ),
          ),
        );
      }

      return factory.createCallExpression(
        factory.createIdentifier("createGADT"),
        callExpr.typeArguments,
        [factory.createObjectLiteralExpression(variantEntries, true)],
      );
    }

    return callExpr;
  },
});

// ============================================================================
// matchGadt Expression Macro — compile-time optimized matching
// ============================================================================

/**
 * matchGadt macro — compiles pattern matching into optimized if/else chains.
 *
 * Unlike the runtime `match` method, this macro inlines the match at
 * compile time, eliminating the function call overhead.
 */
export const matchGadtMacro = defineExpressionMacro({
  name: "matchGadt",
  description:
    "Compile-time optimized GADT pattern matching (inlines to if/else chain)",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    if (args.length < 2) {
      ctx.reportError(
        callExpr,
        "matchGadt() expects (value, { variant: handler, ... })",
      );
      return callExpr;
    }

    const [valueArg, armsArg] = args;
    const factory = ctx.factory;

    // If the arms argument is an object literal, we can inline the match
    if (ts.isObjectLiteralExpression(armsArg)) {
      const arms = armsArg.properties.filter(ts.isPropertyAssignment);

      if (arms.length === 0) {
        ctx.reportError(armsArg, "matchGadt requires at least one arm");
        return callExpr;
      }

      // Build a chain of ternary expressions:
      // value.__tag === "Lit" ? arms.Lit(value)
      // : value.__tag === "Bool" ? arms.Bool(value)
      // : (() => { throw new Error("Non-exhaustive match") })()
      let result: ts.Expression = factory.createCallExpression(
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
                  [factory.createStringLiteral("Non-exhaustive GADT match")],
                ),
              ),
            ]),
          ),
        ),
        undefined,
        [],
      );

      // Build from right to left
      for (let i = arms.length - 1; i >= 0; i--) {
        const arm = arms[i];
        const tagName = ts.isIdentifier(arm.name)
          ? arm.name.text
          : ts.isStringLiteral(arm.name)
            ? arm.name.text
            : null;

        if (!tagName) continue;

        const condition = factory.createBinaryExpression(
          factory.createPropertyAccessExpression(valueArg, "__tag"),
          factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
          factory.createStringLiteral(tagName),
        );

        const handler = factory.createCallExpression(
          arm.initializer as ts.Expression,
          undefined,
          [valueArg],
        );

        result = factory.createConditionalExpression(
          condition,
          factory.createToken(ts.SyntaxKind.QuestionToken),
          handler,
          factory.createToken(ts.SyntaxKind.ColonToken),
          result,
        );
      }

      return result;
    }

    // Fallback: generate value.__tag-based dispatch at runtime
    return factory.createCallExpression(
      factory.createPropertyAccessExpression(armsArg, "match"),
      undefined,
      [valueArg],
    );
  },
});

// ============================================================================
// Register macros
// ============================================================================

globalRegistry.register(gadtMacro);
globalRegistry.register(matchGadtMacro);
