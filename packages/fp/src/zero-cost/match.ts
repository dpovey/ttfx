/**
 * Zero-Cost Exhaustive Pattern Matching
 *
 * A unified match() macro providing Scala-quality pattern matching that compiles
 * to optimized decision trees. Supports discriminated unions with destructuring,
 * literal dispatch, and guard predicates — all with compile-time exhaustiveness
 * checking and zero runtime overhead.
 *
 * ## Compilation Strategies
 *
 * The macro selects the optimal code generation strategy based on pattern analysis:
 *
 * | Pattern Kind          | Arms ≤ 6           | Arms > 6                 |
 * |-----------------------|---------------------|--------------------------|
 * | Discriminated union   | Ternary chain       | IIFE + switch statement  |
 * | String literals       | Ternary chain       | IIFE + switch statement  |
 * | Integer literals      | Ternary chain       | Binary search tree       |
 * | Dense integer range   | Ternary chain       | IIFE + switch (V8 jump)  |
 * | Guard predicates      | Ternary chain       | Ternary chain            |
 *
 * Binary search gives O(log n) comparisons for sparse integers vs O(n) linear.
 * Switch statements let V8 apply its own optimizations (hash tables, jump tables).
 *
 * @example
 * ```typescript
 * import { match, when, otherwise } from "@typesugar/fp/zero-cost";
 *
 * // Discriminated union with destructuring
 * type Shape =
 *   | { kind: "circle"; radius: number }
 *   | { kind: "square"; side: number }
 *   | { kind: "triangle"; base: number; height: number };
 *
 * const area = match(shape, {
 *   circle: ({ radius }) => Math.PI * radius ** 2,
 *   square: ({ side }) => side ** 2,
 *   triangle: ({ base, height }) => 0.5 * base * height,
 * });
 * // Compiles to: shape.kind === "circle" ? (({radius}) => ...)(shape) : ...
 *
 * // Literal dispatch with compile-time exhaustiveness
 * const msg = match(statusCode, {
 *   200: () => "OK",
 *   404: () => "Not Found",
 *   500: () => "Server Error",
 *   _: (code) => `Unknown: ${code}`,
 * });
 * // With >6 integer arms: compiles to binary search tree (O(log n))
 *
 * // Guard-based matching
 * const category = match(age, [
 *   when(n => n < 13, () => "child"),
 *   when(n => n < 18, () => "teen"),
 *   when(n => n >= 65, () => "senior"),
 *   otherwise(() => "adult"),
 * ]);
 * // Compiles to: ((n) => n < 13)(age) ? (() => "child")(age) : ...
 * ```
 */

import * as ts from "typescript";
import {
  defineExpressionMacro,
  globalRegistry,
  MacroContext,
} from "@typesugar/core";

// ============================================================================
// Type-Level API
// ============================================================================

/** Extracts discriminant literal values from a union type */
type DiscriminantOf<T, K extends keyof T> =
  T extends Record<K, infer V>
    ? V extends string | number | boolean
      ? V
      : never
    : never;

/** Handler map for discriminated union matching — each handler receives the narrowed variant */
type DiscriminantHandlers<T, K extends keyof T, R> = {
  [V in DiscriminantOf<T, K>]: (value: Extract<T, Record<K, V>>) => R;
} & { _?: (value: T) => R };

/** Handler map for literal value matching */
type LiteralHandlers<T extends string | number, R> = {
  [K in T]?: (value: K) => R;
} & { _?: (value: T) => R };

/** A guard arm produced by when() or otherwise() */
export interface GuardArm<T, R> {
  readonly predicate: (value: T) => boolean;
  readonly handler: (value: T) => R;
}

/** Create a guard arm — matches when predicate returns true */
export function when<T, R>(
  predicate: (value: T) => boolean,
  handler: (value: T) => R,
): GuardArm<T, R> {
  return { predicate, handler };
}

/** Create a catch-all guard arm — always matches */
export function otherwise<T, R>(handler: (value: T) => R): GuardArm<T, R> {
  return { predicate: () => true, handler };
}

// ============================================================================
// Runtime Fallbacks
// ============================================================================

/**
 * Unified pattern matching — compile-time macro with runtime fallback.
 *
 * Three forms:
 * 1. `match(value, { variant: handler, ... })` — discriminated union / literal
 * 2. `match(value, { variant: handler, ... }, "discriminant")` — explicit discriminant
 * 3. `match(value, [when(...), otherwise(...)])` — guard predicates
 */
export function match<T extends Record<string, unknown>, K extends keyof T, R>(
  value: T,
  handlers: DiscriminantHandlers<T, K, R>,
  discriminant?: K,
): R;
export function match<T extends string | number, R>(
  value: T,
  handlers: LiteralHandlers<T, R>,
): R;
export function match<T, R>(value: T, arms: GuardArm<T, R>[]): R;
export function match(
  value: any,
  handlersOrArms: any,
  discriminant?: any,
): any {
  if (Array.isArray(handlersOrArms)) {
    for (const arm of handlersOrArms) {
      if (arm.predicate(value)) return arm.handler(value);
    }
    throw new Error("Non-exhaustive match: no guard matched");
  }
  if (typeof value === "object" && value !== null) {
    const key = discriminant ?? "kind";
    const tag = value[key] as string;
    const handler = handlersOrArms[tag] ?? handlersOrArms._;
    if (!handler)
      throw new Error(`Non-exhaustive match: no handler for '${String(tag)}'`);
    return handler(value);
  }
  const handler = handlersOrArms[value] ?? handlersOrArms._;
  if (!handler)
    throw new Error(`Non-exhaustive match: no handler for '${String(value)}'`);
  return handler(value);
}

/** @deprecated Use `match()` with literal keys instead */
export function matchLiteral<T extends string | number, R>(
  value: T,
  handlers: LiteralHandlers<T, R>,
): R {
  const handler = (
    handlers as Record<string | number, ((v: T) => R) | undefined>
  )[value];
  if (handler) return handler(value);
  const wildcard = (handlers as Record<string, ((v: T) => R) | undefined>)["_"];
  if (wildcard) return wildcard(value);
  throw new Error(`Non-exhaustive match: no handler for '${value}'`);
}

/** @deprecated Use `match()` with when()/otherwise() arms instead */
export function matchGuard<T, R>(
  value: T,
  arms: Array<[(value: T) => boolean, (value: T) => R]>,
): R {
  for (const [pred, handler] of arms) {
    if (pred(value)) return handler(value);
  }
  throw new Error("Non-exhaustive match: no guard matched");
}

// ============================================================================
// Exhaustiveness Checking
// ============================================================================

const KNOWN_DISCRIMINANTS = [
  "kind",
  "_tag",
  "type",
  "tag",
  "__typename",
  "ok",
  "status",
];

function detectDiscriminant(
  type: ts.Type,
  checker: ts.TypeChecker,
): string | null {
  if (!type.isUnion()) return null;
  for (const candidate of KNOWN_DISCRIMINANTS) {
    let allHave = true;
    let allLiteral = true;
    for (const member of type.types) {
      const prop = member.getProperty(candidate);
      if (!prop) {
        allHave = false;
        break;
      }
      const propType = checker.getTypeOfSymbol(prop);
      if (
        !propType.isStringLiteral() &&
        !propType.isNumberLiteral() &&
        !(propType.flags & ts.TypeFlags.BooleanLiteral)
      ) {
        allLiteral = false;
        break;
      }
    }
    if (allHave && allLiteral) return candidate;
  }
  return null;
}

function getUnionVariantTags(
  type: ts.Type,
  discriminant: string,
  checker: ts.TypeChecker,
): Set<string> {
  const tags = new Set<string>();
  if (!type.isUnion()) return tags;
  for (const member of type.types) {
    const prop = member.getProperty(discriminant);
    if (!prop) continue;
    const propType = checker.getTypeOfSymbol(prop);
    if (propType.isStringLiteral()) {
      tags.add(propType.value);
    } else if (propType.isNumberLiteral()) {
      tags.add(String(propType.value));
    } else if (propType.flags & ts.TypeFlags.BooleanLiteral) {
      const boolName = (propType as ts.Type & { intrinsicName?: string })
        .intrinsicName;
      tags.add(boolName === "true" ? "true" : "false");
    }
  }
  return tags;
}

function getLiteralTypeValues(type: ts.Type): Set<string> | null {
  const values = new Set<string>();
  if (type.isUnion()) {
    for (const member of type.types) {
      if (member.isStringLiteral()) values.add(member.value);
      else if (member.isNumberLiteral()) values.add(String(member.value));
      else return null;
    }
    return values.size > 0 ? values : null;
  }
  if (type.isStringLiteral()) {
    values.add(type.value);
    return values;
  }
  if (type.isNumberLiteral()) {
    values.add(String(type.value));
    return values;
  }
  return null;
}

interface ExhaustivenessResult {
  isExhaustive: boolean;
  missingVariants: string[];
  extraVariants: string[];
}

function checkExhaustiveness(
  expectedVariants: Set<string>,
  providedKeys: string[],
  hasWildcard: boolean,
): ExhaustivenessResult {
  const providedSet = new Set(providedKeys);
  const missing = [...expectedVariants].filter((v) => !providedSet.has(v));
  const extra = [...providedSet].filter((v) => !expectedVariants.has(v));
  return {
    isExhaustive: hasWildcard || missing.length === 0,
    missingVariants: missing,
    extraVariants: extra,
  };
}

function performExhaustivenessCheck(
  ctx: MacroContext,
  callExpr: ts.CallExpression,
  value: ts.Expression,
  analysis: MatchAnalysis,
): void {
  const checker = ctx.typeChecker;
  const valueType = ctx.getTypeOf(value);
  let expectedVariants: Set<string> | null = null;

  if (analysis.form === MatchForm.Discriminant && analysis.discriminant) {
    expectedVariants = getUnionVariantTags(
      valueType,
      analysis.discriminant,
      checker,
    );
  } else if (
    analysis.form === MatchForm.StringLiteral ||
    analysis.form === MatchForm.IntegerLiteral
  ) {
    expectedVariants = getLiteralTypeValues(valueType);
  }

  if (!expectedVariants || expectedVariants.size === 0) return;

  const result = checkExhaustiveness(
    expectedVariants,
    analysis.keys,
    analysis.hasWildcard,
  );
  if (!result.isExhaustive && result.missingVariants.length > 0) {
    const label = result.missingVariants.length === 1 ? "case" : "cases";
    ctx.reportError(
      callExpr,
      `Non-exhaustive match: missing ${label} for ` +
        result.missingVariants.map((v) => `'${v}'`).join(", "),
    );
  }
  for (const extra of result.extraVariants) {
    ctx.reportWarning(
      callExpr,
      `match() has handler for unknown variant '${extra}'`,
    );
  }
}

// ============================================================================
// Code Generation Strategies
// ============================================================================

/** Threshold at which we switch from ternary chains to switch/binary-search */
const SWITCH_THRESHOLD = 6;

function generateTernaryChain(
  factory: ts.NodeFactory,
  entries: Array<{ condition: ts.Expression; result: ts.Expression }>,
  fallback: ts.Expression,
): ts.Expression {
  let result = fallback;
  for (let i = entries.length - 1; i >= 0; i--) {
    result = factory.createConditionalExpression(
      entries[i].condition,
      factory.createToken(ts.SyntaxKind.QuestionToken),
      entries[i].result,
      factory.createToken(ts.SyntaxKind.ColonToken),
      result,
    );
  }
  return result;
}

/**
 * Generates: ((__v) => { switch(__v) { case X: return ...; default: return ...; } })(scrutinee)
 *
 * The IIFE parameter ensures the scrutinee is evaluated exactly once.
 * V8 optimizes switch on strings via hash tables, on dense ints via jump tables.
 */
function generateSwitchIIFE(
  factory: ts.NodeFactory,
  scrutinee: ts.Expression,
  switchTarget: (param: ts.Identifier) => ts.Expression,
  cases: Array<{ test: ts.Expression; body: ts.Expression }>,
  defaultBody: ts.Expression,
): ts.Expression {
  const paramId = factory.createIdentifier("__v");
  const param = factory.createParameterDeclaration(
    undefined,
    undefined,
    paramId,
  );

  const clauseList = cases.map((c) =>
    factory.createCaseClause(c.test, [factory.createReturnStatement(c.body)]),
  );
  clauseList.push(
    factory.createDefaultClause([factory.createReturnStatement(defaultBody)]),
  );

  const switchStmt = factory.createSwitchStatement(
    switchTarget(paramId),
    factory.createCaseBlock(clauseList),
  );

  const fn = factory.createArrowFunction(
    undefined,
    undefined,
    [param],
    undefined,
    factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
    factory.createBlock([switchStmt], true),
  );

  return factory.createCallExpression(
    factory.createParenthesizedExpression(fn),
    undefined,
    [scrutinee],
  );
}

/**
 * Balanced binary search tree over sorted numeric entries.
 *
 * For n entries, performs at most ⌈log₂(n)⌉ + 1 comparisons (one < and one ===
 * per level), compared to n comparisons for a linear scan. The generated code is
 * a tree of ternary expressions — no IIFE, no statements, purely expression-level.
 */
function generateBinarySearch(
  factory: ts.NodeFactory,
  scrutinee: ts.Expression,
  entries: Array<{ value: number; result: ts.Expression }>,
  fallback: ts.Expression,
): ts.Expression {
  const sorted = [...entries].sort((a, b) => a.value - b.value);
  return binarySearchHelper(
    factory,
    scrutinee,
    sorted,
    fallback,
    0,
    sorted.length - 1,
  );
}

function binarySearchHelper(
  factory: ts.NodeFactory,
  scrutinee: ts.Expression,
  entries: Array<{ value: number; result: ts.Expression }>,
  fallback: ts.Expression,
  lo: number,
  hi: number,
): ts.Expression {
  if (lo > hi) return fallback;

  if (lo === hi) {
    return factory.createConditionalExpression(
      factory.createBinaryExpression(
        scrutinee,
        factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
        factory.createNumericLiteral(entries[lo].value),
      ),
      factory.createToken(ts.SyntaxKind.QuestionToken),
      entries[lo].result,
      factory.createToken(ts.SyntaxKind.ColonToken),
      fallback,
    );
  }

  const mid = (lo + hi) >>> 1;
  const midValue = entries[mid].value;

  // scrutinee < midValue ? search(lo..mid-1) : (scrutinee === midValue ? result : search(mid+1..hi))
  return factory.createConditionalExpression(
    factory.createBinaryExpression(
      scrutinee,
      factory.createToken(ts.SyntaxKind.LessThanToken),
      factory.createNumericLiteral(midValue),
    ),
    factory.createToken(ts.SyntaxKind.QuestionToken),
    binarySearchHelper(factory, scrutinee, entries, fallback, lo, mid - 1),
    factory.createToken(ts.SyntaxKind.ColonToken),
    factory.createConditionalExpression(
      factory.createBinaryExpression(
        scrutinee,
        factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
        factory.createNumericLiteral(midValue),
      ),
      factory.createToken(ts.SyntaxKind.QuestionToken),
      entries[mid].result,
      factory.createToken(ts.SyntaxKind.ColonToken),
      binarySearchHelper(factory, scrutinee, entries, fallback, mid + 1, hi),
    ),
  );
}

function isDenseIntegerRange(values: number[]): boolean {
  if (values.length < 2) return true;
  const sorted = [...values].sort((a, b) => a - b);
  const range = sorted[sorted.length - 1] - sorted[0] + 1;
  return range <= values.length * 2;
}

function generateThrowIIFE(
  factory: ts.NodeFactory,
  message: string,
): ts.Expression {
  return factory.createCallExpression(
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
              [factory.createStringLiteral(message)],
            ),
          ),
        ]),
      ),
    ),
    undefined,
    [],
  );
}

// ============================================================================
// Match Form Detection
// ============================================================================

const enum MatchForm {
  Discriminant,
  StringLiteral,
  IntegerLiteral,
  Guard,
  Mixed,
}

interface HandlerEntry {
  name: string;
  handler: ts.Expression;
}

interface MatchAnalysis {
  form: MatchForm;
  discriminant?: string;
  keys: string[];
  handlers: HandlerEntry[];
  wildcardHandler?: ts.Expression;
  hasWildcard: boolean;
}

function extractHandlers(
  factory: ts.NodeFactory,
  obj: ts.ObjectLiteralExpression,
): { entries: HandlerEntry[]; wildcardHandler?: ts.Expression } {
  const entries: HandlerEntry[] = [];
  let wildcardHandler: ts.Expression | undefined;

  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop) && !ts.isMethodDeclaration(prop))
      continue;
    const name = ts.isIdentifier(prop.name)
      ? prop.name.text
      : ts.isStringLiteral(prop.name)
        ? prop.name.text
        : ts.isNumericLiteral(prop.name)
          ? prop.name.text
          : null;
    if (!name) continue;

    let handler: ts.Expression;
    if (ts.isPropertyAssignment(prop)) {
      handler = prop.initializer;
    } else {
      handler = factory.createArrowFunction(
        undefined,
        undefined,
        prop.parameters,
        undefined,
        factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
        prop.body ?? factory.createBlock([]),
      );
    }

    if (name === "_") {
      wildcardHandler = handler;
    } else {
      entries.push({ name, handler });
    }
  }
  return { entries, wildcardHandler };
}

function analyzeMatchForm(
  ctx: MacroContext,
  value: ts.Expression,
  handlers: ts.ObjectLiteralExpression,
  explicitDiscriminant?: string,
): MatchAnalysis {
  const factory = ctx.factory;
  const checker = ctx.typeChecker;
  const valueType = ctx.getTypeOf(value);
  const { entries, wildcardHandler } = extractHandlers(factory, handlers);
  const keys = entries.map((e) => e.name);
  const hasWildcard = wildcardHandler !== undefined;

  if (explicitDiscriminant) {
    return {
      form: MatchForm.Discriminant,
      discriminant: explicitDiscriminant,
      keys,
      handlers: entries,
      wildcardHandler,
      hasWildcard,
    };
  }

  if (
    keys.length > 0 &&
    keys.every((k) => !isNaN(Number(k)) && k.trim() !== "")
  ) {
    return {
      form: MatchForm.IntegerLiteral,
      keys,
      handlers: entries,
      wildcardHandler,
      hasWildcard,
    };
  }

  const disc = detectDiscriminant(valueType, checker);
  if (disc) {
    return {
      form: MatchForm.Discriminant,
      discriminant: disc,
      keys,
      handlers: entries,
      wildcardHandler,
      hasWildcard,
    };
  }

  const literalValues = getLiteralTypeValues(valueType);
  if (literalValues) {
    return {
      form: MatchForm.StringLiteral,
      keys,
      handlers: entries,
      wildcardHandler,
      hasWildcard,
    };
  }

  return {
    form: MatchForm.Mixed,
    keys,
    handlers: entries,
    wildcardHandler,
    hasWildcard,
  };
}

// ============================================================================
// Per-Form Expansion
// ============================================================================

function expandDiscriminantMatch(
  ctx: MacroContext,
  value: ts.Expression,
  analysis: MatchAnalysis,
): ts.Expression {
  const factory = ctx.factory;
  const disc = analysis.discriminant!;
  const fallback = analysis.wildcardHandler
    ? factory.createCallExpression(analysis.wildcardHandler, undefined, [value])
    : generateThrowIIFE(factory, "Non-exhaustive match");

  if (analysis.handlers.length > SWITCH_THRESHOLD) {
    const paramId = factory.createIdentifier("__v");
    const cases = analysis.handlers.map((h) => ({
      test: factory.createStringLiteral(h.name) as ts.Expression,
      body: factory.createCallExpression(h.handler, undefined, [paramId]),
    }));
    const defaultBody = analysis.wildcardHandler
      ? factory.createCallExpression(analysis.wildcardHandler, undefined, [
          paramId,
        ])
      : generateThrowIIFE(factory, "Non-exhaustive match");

    return generateSwitchIIFE(
      factory,
      value,
      (param) => factory.createPropertyAccessExpression(param, disc),
      cases,
      defaultBody,
    );
  }

  const entries = analysis.handlers.map((h) => ({
    condition: factory.createBinaryExpression(
      factory.createPropertyAccessExpression(value, disc),
      factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
      factory.createStringLiteral(h.name),
    ),
    result: factory.createCallExpression(h.handler, undefined, [value]),
  }));

  return generateTernaryChain(factory, entries, fallback);
}

function expandIntegerMatch(
  ctx: MacroContext,
  value: ts.Expression,
  analysis: MatchAnalysis,
): ts.Expression {
  const factory = ctx.factory;
  const fallback = analysis.wildcardHandler
    ? factory.createCallExpression(analysis.wildcardHandler, undefined, [value])
    : generateThrowIIFE(factory, "Non-exhaustive match");

  const numericEntries = analysis.handlers.map((h) => ({
    value: Number(h.name),
    handler: h.handler,
  }));

  const values = numericEntries.map((e) => e.value);

  if (numericEntries.length > SWITCH_THRESHOLD && isDenseIntegerRange(values)) {
    const paramId = factory.createIdentifier("__v");
    const cases = numericEntries.map((e) => ({
      test: factory.createNumericLiteral(e.value) as ts.Expression,
      body: factory.createCallExpression(e.handler, undefined, [paramId]),
    }));
    const defaultBody = analysis.wildcardHandler
      ? factory.createCallExpression(analysis.wildcardHandler, undefined, [
          paramId,
        ])
      : generateThrowIIFE(factory, "Non-exhaustive match");

    return generateSwitchIIFE(
      factory,
      value,
      (param) => param,
      cases,
      defaultBody,
    );
  }

  if (numericEntries.length > SWITCH_THRESHOLD) {
    const bsEntries = numericEntries.map((e) => ({
      value: e.value,
      result: factory.createCallExpression(e.handler, undefined, [value]),
    }));
    return generateBinarySearch(factory, value, bsEntries, fallback);
  }

  const entries = numericEntries.map((e) => ({
    condition: factory.createBinaryExpression(
      value,
      factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
      factory.createNumericLiteral(e.value),
    ),
    result: factory.createCallExpression(e.handler, undefined, [value]),
  }));

  return generateTernaryChain(factory, entries, fallback);
}

function expandLiteralMatch(
  ctx: MacroContext,
  value: ts.Expression,
  analysis: MatchAnalysis,
): ts.Expression {
  const factory = ctx.factory;
  const fallback = analysis.wildcardHandler
    ? factory.createCallExpression(analysis.wildcardHandler, undefined, [value])
    : generateThrowIIFE(factory, "Non-exhaustive match");

  if (analysis.handlers.length > SWITCH_THRESHOLD) {
    const paramId = factory.createIdentifier("__v");
    const cases = analysis.handlers.map((h) => ({
      test: factory.createStringLiteral(h.name) as ts.Expression,
      body: factory.createCallExpression(h.handler, undefined, [paramId]),
    }));
    const defaultBody = analysis.wildcardHandler
      ? factory.createCallExpression(analysis.wildcardHandler, undefined, [
          paramId,
        ])
      : generateThrowIIFE(factory, "Non-exhaustive match");

    return generateSwitchIIFE(
      factory,
      value,
      (param) => param,
      cases,
      defaultBody,
    );
  }

  const entries = analysis.handlers.map((h) => ({
    condition: factory.createBinaryExpression(
      value,
      factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
      factory.createStringLiteral(h.name),
    ),
    result: factory.createCallExpression(h.handler, undefined, [value]),
  }));

  return generateTernaryChain(factory, entries, fallback);
}

function expandGuardMatch(
  ctx: MacroContext,
  callExpr: ts.CallExpression,
  value: ts.Expression,
  arms: ts.ArrayLiteralExpression,
): ts.Expression {
  const factory = ctx.factory;
  const guardArms: Array<{ predicate: ts.Expression; handler: ts.Expression }> =
    [];

  for (const element of arms.elements) {
    if (ts.isCallExpression(element) && ts.isIdentifier(element.expression)) {
      const fnName = element.expression.text;
      if (fnName === "when" && element.arguments.length === 2) {
        guardArms.push({
          predicate: element.arguments[0],
          handler: element.arguments[1],
        });
        continue;
      }
      if (fnName === "otherwise" && element.arguments.length === 1) {
        guardArms.push({
          predicate: factory.createArrowFunction(
            undefined,
            undefined,
            [],
            undefined,
            factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            factory.createTrue(),
          ),
          handler: element.arguments[0],
        });
        continue;
      }
    }

    // Backwards-compatible [predicate, handler] tuple form
    if (ts.isArrayLiteralExpression(element) && element.elements.length === 2) {
      guardArms.push({
        predicate: element.elements[0],
        handler: element.elements[1],
      });
      continue;
    }

    ctx.reportError(
      element,
      "Invalid match arm: expected when(pred, handler), otherwise(handler), or [pred, handler]",
    );
  }

  if (guardArms.length === 0) {
    ctx.reportError(callExpr, "match() requires at least one arm");
    return callExpr;
  }

  const fallback = generateThrowIIFE(
    factory,
    "Non-exhaustive match: no guard matched",
  );

  const entries = guardArms.map((arm) => ({
    condition: factory.createCallExpression(arm.predicate, undefined, [value]),
    result: factory.createCallExpression(arm.handler, undefined, [value]),
  }));

  return generateTernaryChain(factory, entries, fallback);
}

// ============================================================================
// Main Macro
// ============================================================================

function expandMatch(
  ctx: MacroContext,
  callExpr: ts.CallExpression,
  args: readonly ts.Expression[],
): ts.Expression {
  if (args.length < 2) {
    ctx.reportError(
      callExpr,
      "match() requires at least 2 arguments: value and handlers/arms",
    );
    return callExpr;
  }

  const value = args[0];
  const handlersOrArms = args[1];

  if (ts.isArrayLiteralExpression(handlersOrArms)) {
    return expandGuardMatch(ctx, callExpr, value, handlersOrArms);
  }

  if (!ts.isObjectLiteralExpression(handlersOrArms)) {
    ctx.reportError(
      handlersOrArms,
      "match() second argument must be an object literal or array of guard arms",
    );
    return callExpr;
  }

  let explicitDiscriminant: string | undefined;
  if (args.length >= 3 && ts.isStringLiteral(args[2])) {
    explicitDiscriminant = args[2].text;
  }

  const analysis = analyzeMatchForm(
    ctx,
    value,
    handlersOrArms,
    explicitDiscriminant,
  );
  performExhaustivenessCheck(ctx, callExpr, value, analysis);

  switch (analysis.form) {
    case MatchForm.Discriminant:
      return expandDiscriminantMatch(ctx, value, analysis);
    case MatchForm.IntegerLiteral:
      return expandIntegerMatch(ctx, value, analysis);
    case MatchForm.StringLiteral:
    case MatchForm.Mixed:
      return expandLiteralMatch(ctx, value, analysis);
    default:
      return callExpr;
  }
}

export const matchMacro = defineExpressionMacro({
  name: "match",
  module: "@typesugar/fp",
  description:
    "Zero-cost exhaustive pattern matching with compile-time optimization",
  expand: expandMatch,
});

export const matchLiteralMacro = defineExpressionMacro({
  name: "matchLiteral",
  module: "@typesugar/fp",
  description: "Zero-cost literal matching (deprecated — use match())",
  expand: expandMatch,
});

export const matchGuardMacro = defineExpressionMacro({
  name: "matchGuard",
  module: "@typesugar/fp",
  description: "Zero-cost guard matching (deprecated — use match())",
  expand: expandMatch,
});

globalRegistry.register(matchMacro);
globalRegistry.register(matchLiteralMacro);
globalRegistry.register(matchGuardMacro);
