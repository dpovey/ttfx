/**
 * Zero-Cost Exhaustive Pattern Matching
 *
 * Compiles match expressions into optimized if/else chains or switch
 * statements — no closures, no arrays of patterns, no runtime matching engine.
 *
 * Supports:
 * - Discriminated unions (tagged unions)
 * - Literal matching (string, number, boolean)
 * - Predicate guards
 * - Wildcard/default cases
 * - Nested destructuring
 *
 * Inspired by Rust's match, Scala's pattern matching, and ts-pattern.
 *
 * @example
 * ```typescript
 * // Source (what you write):
 * type Shape =
 *   | { kind: "circle"; radius: number }
 *   | { kind: "rect"; width: number; height: number }
 *   | { kind: "triangle"; base: number; height: number };
 *
 * const area = match(shape, {
 *   circle: (s) => Math.PI * s.radius ** 2,
 *   rect: (s) => s.width * s.height,
 *   triangle: (s) => 0.5 * s.base * s.height,
 * });
 *
 * // Compiled output (what runs):
 * const area =
 *   shape.kind === "circle" ? ((s) => Math.PI * s.radius ** 2)(shape)
 *   : shape.kind === "rect" ? ((s) => s.width * s.height)(shape)
 *   : ((s) => 0.5 * s.base * s.height)(shape);
 * ```
 *
 * @example
 * ```typescript
 * // matchLiteral for simple value matching:
 * const label = matchLiteral(statusCode, {
 *   200: () => "OK",
 *   404: () => "Not Found",
 *   500: () => "Server Error",
 *   _: () => "Unknown",
 * });
 *
 * // Compiled output:
 * const label =
 *   statusCode === 200 ? "OK"
 *   : statusCode === 404 ? "Not Found"
 *   : statusCode === 500 ? "Server Error"
 *   : "Unknown";
 * ```
 *
 * @example
 * ```typescript
 * // matchGuard for predicate-based matching:
 * const category = matchGuard(score, [
 *   [s => s >= 90, () => "A"],
 *   [s => s >= 80, () => "B"],
 *   [s => s >= 70, () => "C"],
 *   [() => true,   () => "F"],
 * ]);
 *
 * // Compiled output:
 * const category =
 *   score >= 90 ? "A"
 *   : score >= 80 ? "B"
 *   : score >= 70 ? "C"
 *   : "F";
 * ```
 */

import * as ts from "typescript";
import {
  defineExpressionMacro,
  globalRegistry,
  MacroContext,
} from "@ttfx/core";

// ============================================================================
// Type-Level API
// ============================================================================

/** Extract the discriminant values from a union type */
type DiscriminantOf<T, K extends keyof T> =
  T extends Record<K, infer V> ? (V extends string ? V : never) : never;

/** Handler map for discriminated union matching */
type MatchHandlers<T, K extends keyof T, R> = {
  [V in DiscriminantOf<T, K>]: (value: Extract<T, Record<K, V>>) => R;
};

/** Handler map for literal matching (with optional wildcard) */
type LiteralHandlers<T extends string | number, R> = {
  [K in T]?: () => R;
} & {
  _?: () => R;
};

/** Guard-based match arm */
type GuardArm<T, R> = [(value: T) => boolean, (value: T) => R];

/**
 * Match on a discriminated union. Exhaustive by default.
 *
 * @param value - The value to match on
 * @param handlers - Object mapping discriminant values to handler functions
 * @param discriminant - The discriminant key (default: "kind")
 */
export function match<T extends Record<string, unknown>, K extends keyof T, R>(
  value: T,
  handlers: MatchHandlers<T, K, R>,
  discriminant?: K,
): R {
  const key = (discriminant ?? "kind") as K;
  const tag = value[key] as string;
  const handler = (handlers as Record<string, (v: T) => R>)[tag];
  if (!handler) {
    throw new Error(`No handler for discriminant: ${String(tag)}`);
  }
  return handler(value);
}

/**
 * Match on literal values (strings, numbers).
 * Use _ for the default/wildcard case.
 */
export function matchLiteral<T extends string | number, R>(
  value: T,
  handlers: LiteralHandlers<T, R>,
): R {
  const handler = (handlers as Record<string | number, (() => R) | undefined>)[
    value
  ];
  if (handler) return handler();
  const wildcard = (handlers as Record<string, (() => R) | undefined>)["_"];
  if (wildcard) return wildcard();
  throw new Error(`No handler for value: ${value}`);
}

/**
 * Match with predicate guards. First matching guard wins.
 */
export function matchGuard<T, R>(value: T, arms: GuardArm<T, R>[]): R {
  for (const [pred, handler] of arms) {
    if (pred(value)) return handler(value);
  }
  throw new Error("No matching guard");
}

// ============================================================================
// Match Macro - Compiles to if/else chains
// ============================================================================

export const matchMacro = defineExpressionMacro({
  name: "match",
  description:
    "Zero-cost pattern matching — compiles to inlined if/else chains",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    const factory = ctx.factory;

    if (args.length < 2) {
      ctx.reportError(
        callExpr,
        "match() requires a value and a handlers object",
      );
      return callExpr;
    }

    const value = args[0];
    const handlersArg = args[1];
    const discriminant = args.length >= 3 ? args[2] : undefined;

    // Determine the discriminant key
    let keyName = "kind";
    if (discriminant && ts.isStringLiteral(discriminant)) {
      keyName = discriminant.text;
    }

    // The handlers must be an object literal for compile-time expansion
    if (!ts.isObjectLiteralExpression(handlersArg)) {
      ctx.reportError(
        handlersArg,
        "match() handlers must be an object literal for compile-time expansion",
      );
      return callExpr;
    }

    // Build a chain of ternary expressions:
    // value.kind === "a" ? handlerA(value) : value.kind === "b" ? handlerB(value) : ...
    const properties = handlersArg.properties.filter(
      (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p),
    );

    if (properties.length === 0) {
      ctx.reportError(handlersArg, "match() handlers object is empty");
      return callExpr;
    }

    // Build from last to first (right-fold into ternaries)
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
                [factory.createStringLiteral("Non-exhaustive match")],
              ),
            ),
          ]),
        ),
      ),
      undefined,
      [],
    );

    // Process in reverse so we build the ternary chain correctly
    for (let i = properties.length - 1; i >= 0; i--) {
      const prop = properties[i];
      const propName = ts.isIdentifier(prop.name)
        ? prop.name.text
        : ts.isStringLiteral(prop.name)
          ? prop.name.text
          : null;

      if (!propName) continue;

      const handler = prop.initializer;

      // Wildcard case
      if (propName === "_") {
        if (ts.isArrowFunction(handler) && !ts.isBlock(handler.body)) {
          result =
            handler.parameters.length === 0
              ? (handler.body as ts.Expression)
              : factory.createCallExpression(handler, undefined, [value]);
        } else {
          result = factory.createCallExpression(handler, undefined, [value]);
        }
        continue;
      }

      // Discriminated case: value.kind === "propName" ? handler(value) : ...
      const condition = factory.createBinaryExpression(
        factory.createPropertyAccessExpression(value, keyName),
        factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
        factory.createStringLiteral(propName),
      );

      const thenExpr = factory.createCallExpression(handler, undefined, [
        value,
      ]);

      result = factory.createConditionalExpression(
        condition,
        factory.createToken(ts.SyntaxKind.QuestionToken),
        thenExpr,
        factory.createToken(ts.SyntaxKind.ColonToken),
        result,
      );
    }

    return result;
  },
});

// ============================================================================
// MatchLiteral Macro
// ============================================================================

export const matchLiteralMacro = defineExpressionMacro({
  name: "matchLiteral",
  description:
    "Zero-cost literal matching — compiles to inlined equality checks",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    const factory = ctx.factory;

    if (args.length !== 2) {
      ctx.reportError(
        callExpr,
        "matchLiteral() requires a value and a handlers object",
      );
      return callExpr;
    }

    const value = args[0];
    const handlersArg = args[1];

    if (!ts.isObjectLiteralExpression(handlersArg)) {
      ctx.reportError(
        handlersArg,
        "matchLiteral() handlers must be an object literal",
      );
      return callExpr;
    }

    const properties = handlersArg.properties.filter(
      (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p),
    );

    // Separate wildcard from specific cases
    let wildcardHandler: ts.Expression | undefined;
    const cases: Array<{ literal: ts.Expression; handler: ts.Expression }> = [];

    for (const prop of properties) {
      const propName = ts.isIdentifier(prop.name)
        ? prop.name.text
        : ts.isStringLiteral(prop.name)
          ? prop.name.text
          : ts.isNumericLiteral(prop.name)
            ? prop.name.text
            : null;

      if (!propName) continue;

      if (propName === "_") {
        wildcardHandler = prop.initializer;
        continue;
      }

      // Determine if it's a number or string literal
      const num = Number(propName);
      const literal = !isNaN(num)
        ? factory.createNumericLiteral(num)
        : factory.createStringLiteral(propName);

      cases.push({ literal, handler: prop.initializer });
    }

    // Build ternary chain from right to left
    let result: ts.Expression;
    if (wildcardHandler) {
      // Call the wildcard handler
      result = factory.createCallExpression(wildcardHandler, undefined, []);
    } else {
      result = factory.createCallExpression(
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
                  [factory.createStringLiteral("Non-exhaustive matchLiteral")],
                ),
              ),
            ]),
          ),
        ),
        undefined,
        [],
      );
    }

    for (let i = cases.length - 1; i >= 0; i--) {
      const { literal, handler } = cases[i];
      const condition = factory.createBinaryExpression(
        value,
        factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
        literal,
      );
      const thenExpr = factory.createCallExpression(handler, undefined, []);

      result = factory.createConditionalExpression(
        condition,
        factory.createToken(ts.SyntaxKind.QuestionToken),
        thenExpr,
        factory.createToken(ts.SyntaxKind.ColonToken),
        result,
      );
    }

    return result;
  },
});

// ============================================================================
// MatchGuard Macro
// ============================================================================

export const matchGuardMacro = defineExpressionMacro({
  name: "matchGuard",
  description:
    "Zero-cost guard matching — compiles to inlined predicate checks",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    const factory = ctx.factory;

    if (args.length !== 2) {
      ctx.reportError(
        callExpr,
        "matchGuard() requires a value and an array of guard arms",
      );
      return callExpr;
    }

    const value = args[0];
    const armsArg = args[1];

    if (!ts.isArrayLiteralExpression(armsArg)) {
      ctx.reportError(armsArg, "matchGuard() arms must be an array literal");
      return callExpr;
    }

    // Each arm is [predicate, handler]
    const arms: Array<{ predicate: ts.Expression; handler: ts.Expression }> =
      [];

    for (const element of armsArg.elements) {
      if (
        !ts.isArrayLiteralExpression(element) ||
        element.elements.length !== 2
      ) {
        ctx.reportError(
          element,
          "Each matchGuard arm must be a [predicate, handler] tuple",
        );
        continue;
      }
      arms.push({
        predicate: element.elements[0],
        handler: element.elements[1],
      });
    }

    if (arms.length === 0) {
      ctx.reportError(armsArg, "matchGuard() requires at least one arm");
      return callExpr;
    }

    // Build ternary chain: pred1(value) ? handler1(value) : pred2(value) ? ...
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
                [
                  factory.createStringLiteral(
                    "No matching guard in matchGuard",
                  ),
                ],
              ),
            ),
          ]),
        ),
      ),
      undefined,
      [],
    );

    for (let i = arms.length - 1; i >= 0; i--) {
      const { predicate, handler } = arms[i];

      const condition = factory.createCallExpression(predicate, undefined, [
        value,
      ]);
      const thenExpr = factory.createCallExpression(handler, undefined, [
        value,
      ]);

      result = factory.createConditionalExpression(
        condition,
        factory.createToken(ts.SyntaxKind.QuestionToken),
        thenExpr,
        factory.createToken(ts.SyntaxKind.ColonToken),
        result,
      );
    }

    return result;
  },
});

// ============================================================================
// matchReflect Macro - Auto-detects discriminant via type-checker reflection
// ============================================================================

/**
 * matchReflect(value) — Pattern matching with auto-detected discrimination.
 *
 * Uses compile-time type reflection to automatically determine how to
 * discriminate between union members:
 *
 * 1. **Tagged unions**: Auto-detects common discriminant fields
 *    (kind, _tag, type, tag, etc.)
 *
 * 2. **Class unions**: Uses instanceof checks when union members are classes
 *
 * 3. **Structural unions**: Uses unique property presence checks when
 *    no common discriminant exists
 *
 * @example
 * ```typescript
 * // Auto-detects "kind" field
 * type Shape =
 *   | { kind: "circle"; radius: number }
 *   | { kind: "rect"; width: number; height: number };
 *
 * const area = matchReflect(shape, {
 *   circle: (s) => Math.PI * s.radius ** 2,
 *   rect: (s) => s.width * s.height,
 * });
 *
 * // Auto-uses instanceof for classes
 * class Dog { bark() {} }
 * class Cat { meow() {} }
 * type Pet = Dog | Cat;
 *
 * const sound = matchReflect(pet, {
 *   Dog: (p) => p.bark(),
 *   Cat: (p) => p.meow(),
 * });
 * ```
 */
export const matchReflectMacro = defineExpressionMacro({
  name: "matchReflect",
  description:
    "Zero-cost pattern matching with auto-detected discrimination via reflection",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    const factory = ctx.factory;

    if (args.length < 2) {
      ctx.reportError(
        callExpr,
        "matchReflect() requires a value and a handlers object",
      );
      return callExpr;
    }

    const value = args[0];
    const handlersArg = args[1];

    if (!ts.isObjectLiteralExpression(handlersArg)) {
      ctx.reportError(
        handlersArg,
        "matchReflect() handlers must be an object literal",
      );
      return callExpr;
    }

    // Get the type of the value being matched
    const valueType = ctx.typeChecker.getTypeAtLocation(value);

    // Analyze the type to determine discrimination strategy
    const strategy = analyzeDiscriminationStrategy(ctx, valueType);

    // Build the match expression based on the detected strategy
    const properties = handlersArg.properties.filter(
      (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p),
    );

    if (properties.length === 0) {
      ctx.reportError(handlersArg, "matchReflect() handlers object is empty");
      return callExpr;
    }

    // Build ternary chain based on strategy
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
                [factory.createStringLiteral("Non-exhaustive matchReflect")],
              ),
            ),
          ]),
        ),
      ),
      undefined,
      [],
    );

    // Process in reverse for correct ternary chain
    for (let i = properties.length - 1; i >= 0; i--) {
      const prop = properties[i];
      const propName = ts.isIdentifier(prop.name)
        ? prop.name.text
        : ts.isStringLiteral(prop.name)
          ? prop.name.text
          : null;

      if (!propName) continue;

      const handler = prop.initializer;

      // Wildcard case
      if (propName === "_") {
        if (ts.isArrowFunction(handler) && !ts.isBlock(handler.body)) {
          result =
            handler.parameters.length === 0
              ? (handler.body as ts.Expression)
              : factory.createCallExpression(handler, undefined, [value]);
        } else {
          result = factory.createCallExpression(handler, undefined, [value]);
        }
        continue;
      }

      // Build condition based on strategy
      let condition: ts.Expression;

      switch (strategy.kind) {
        case "tagged":
          // value.discriminant === "tag"
          condition = factory.createBinaryExpression(
            factory.createPropertyAccessExpression(
              value,
              strategy.discriminant,
            ),
            factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
            factory.createStringLiteral(propName),
          );
          break;

        case "instanceof":
          // value instanceof ClassName
          condition = factory.createBinaryExpression(
            value,
            factory.createToken(ts.SyntaxKind.InstanceOfKeyword),
            factory.createIdentifier(propName),
          );
          break;

        case "structural": {
          // Check for unique property: "uniqueProp" in value
          const uniqueProp = strategy.uniqueProps.get(propName);
          if (uniqueProp) {
            condition = factory.createBinaryExpression(
              factory.createStringLiteral(uniqueProp),
              factory.createToken(ts.SyntaxKind.InKeyword),
              value,
            );
          } else {
            // Fallback to type guard (less optimal)
            condition = factory.createTrue();
          }
          break;
        }

        default:
          // Fallback
          condition = factory.createTrue();
      }

      const thenExpr = factory.createCallExpression(handler, undefined, [
        value,
      ]);

      result = factory.createConditionalExpression(
        condition,
        factory.createToken(ts.SyntaxKind.QuestionToken),
        thenExpr,
        factory.createToken(ts.SyntaxKind.ColonToken),
        result,
      );
    }

    return result;
  },
});

/**
 * Discrimination strategy types
 */
type DiscriminationStrategy =
  | { kind: "tagged"; discriminant: string }
  | { kind: "instanceof"; classNames: string[] }
  | { kind: "structural"; uniqueProps: Map<string, string> }
  | { kind: "unknown" };

/**
 * Analyze a union type to determine the best discrimination strategy.
 *
 * Priority order:
 * 1. Tagged union with common discriminant field
 * 2. Class union with instanceof
 * 3. Structural discrimination with unique properties
 */
function analyzeDiscriminationStrategy(
  ctx: MacroContext,
  type: ts.Type,
): DiscriminationStrategy {
  // Check if it's a union type
  if (!type.isUnion()) {
    return { kind: "unknown" };
  }

  const unionTypes = type.types;

  // Strategy 1: Check for common discriminant field
  const commonDiscriminants = ["kind", "_tag", "type", "tag", "__typename"];
  for (const discriminant of commonDiscriminants) {
    if (hasCommonLiteralDiscriminant(ctx, unionTypes, discriminant)) {
      return { kind: "tagged", discriminant };
    }
  }

  // Strategy 2: Check if all members are classes (for instanceof)
  const classNames = tryGetClassNames(ctx, unionTypes);
  if (classNames) {
    return { kind: "instanceof", classNames };
  }

  // Strategy 3: Find unique properties for each member
  const uniqueProps = findUniqueProperties(ctx, unionTypes);
  if (uniqueProps.size > 0) {
    return { kind: "structural", uniqueProps };
  }

  return { kind: "unknown" };
}

/**
 * Check if all union members have a common discriminant field with literal types.
 */
function hasCommonLiteralDiscriminant(
  ctx: MacroContext,
  types: readonly ts.Type[],
  fieldName: string,
): boolean {
  const seenValues = new Set<string>();

  for (const memberType of types) {
    const props = memberType.getProperties();
    const discriminantProp = props.find((p) => p.name === fieldName);

    if (!discriminantProp) return false;

    // Get the type of the discriminant property
    const propType = ctx.typeChecker.getTypeOfSymbolAtLocation(
      discriminantProp,
      discriminantProp.valueDeclaration!,
    );

    // Must be a string literal type
    if (!propType.isStringLiteral()) return false;

    const value = propType.value;
    if (seenValues.has(value)) return false; // Duplicate discriminant values
    seenValues.add(value);
  }

  return seenValues.size === types.length && seenValues.size > 0;
}

/**
 * Try to get class names if all union members are classes.
 */
function tryGetClassNames(
  ctx: MacroContext,
  types: readonly ts.Type[],
): string[] | null {
  const classNames: string[] = [];

  for (const memberType of types) {
    const symbol = memberType.getSymbol();
    if (!symbol) return null;

    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return null;

    const decl = declarations[0];
    if (!ts.isClassDeclaration(decl)) return null;

    if (decl.name) {
      classNames.push(decl.name.text);
    } else {
      return null;
    }
  }

  return classNames.length > 0 ? classNames : null;
}

/**
 * Find unique properties that can be used to discriminate union members.
 *
 * For each member, finds a property that exists only in that member
 * and not in any other union member.
 */
function findUniqueProperties(
  ctx: MacroContext,
  types: readonly ts.Type[],
): Map<string, string> {
  const uniqueProps = new Map<string, string>();

  // Get all properties for each type
  const typeProps = types.map((t) => {
    const props = t.getProperties();
    const propNames = new Set(props.map((p) => p.name));
    const typeName = ctx.typeChecker.typeToString(t);
    return { type: t, propNames, typeName };
  });

  // For each type, find a property unique to it
  for (const current of typeProps) {
    const others = typeProps.filter((t) => t !== current);

    for (const propName of current.propNames) {
      const isUnique = others.every((o) => !o.propNames.has(propName));
      if (isUnique) {
        // Use the type name (simplified) as the key
        const simpleName =
          current.typeName.match(/(\w+)/)?.[1] || current.typeName;
        uniqueProps.set(simpleName, propName);
        break;
      }
    }
  }

  return uniqueProps;
}

globalRegistry.register(matchMacro);
globalRegistry.register(matchLiteralMacro);
globalRegistry.register(matchGuardMacro);
globalRegistry.register(matchReflectMacro);