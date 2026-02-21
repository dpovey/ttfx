/**
 * Pattern Matching for Expressions
 *
 * Matches expressions against patterns with pattern variables.
 *
 * @example
 * ```typescript
 * const pattern = add(patternVar("a"), patternVar("b"));
 * const expr = add(const_(1), var_("x"));
 * match(expr, pattern); // { a: const_(1), b: var_("x") }
 * ```
 */

import type { Expression } from "./expression.js";
import type { BinaryOpSymbol, UnaryOpSymbol, FunctionName } from "./types.js";
import { isConstant, isVariable } from "./expression.js";

/**
 * A pattern variable that matches any expression.
 */
export interface PatternVariable {
  readonly kind: "pattern-variable";
  readonly name: string;
  readonly constraint?: PatternConstraint;
}

export type PatternConstraint = "constant" | "variable" | "any";

/**
 * A pattern is either an Expression or a PatternVariable.
 */
export type Pattern =
  | Expression<unknown>
  | PatternVariable
  | PatternBinary
  | PatternUnary
  | PatternFunction;

interface PatternBinary {
  readonly kind: "binary";
  readonly op: BinaryOpSymbol;
  readonly left: Pattern;
  readonly right: Pattern;
}

interface PatternUnary {
  readonly kind: "unary";
  readonly op: UnaryOpSymbol;
  readonly arg: Pattern;
}

interface PatternFunction {
  readonly kind: "function";
  readonly fn: FunctionName;
  readonly arg: Pattern;
}

/**
 * Match result: bindings from pattern variable names to expressions.
 */
export type MatchBindings = Map<string, Expression<unknown>>;

/**
 * Create a pattern variable.
 */
export function patternVar(
  name: string,
  constraint: PatternConstraint = "any"
): PatternVariable {
  return { kind: "pattern-variable", name, constraint };
}

export const $a = patternVar("a");
export const $b = patternVar("b");
export const $c = patternVar("c");
export const $x = patternVar("x");
export const $y = patternVar("y");
export const $n = patternVar("n", "constant");

/**
 * Match an expression against a pattern.
 */
export function match(
  expr: Expression<unknown>,
  pattern: Pattern
): MatchBindings | null {
  const bindings = new Map<string, Expression<unknown>>();

  if (matchInternal(expr, pattern, bindings)) {
    return bindings;
  }

  return null;
}

function matchInternal(
  expr: Expression<unknown>,
  pattern: Pattern,
  bindings: MatchBindings
): boolean {
  if (isPatternVariable(pattern)) {
    return matchPatternVariable(expr, pattern, bindings);
  }

  if (expr.kind !== pattern.kind) {
    return false;
  }

  switch (expr.kind) {
    case "constant": {
      const p = pattern as Expression<unknown> & { kind: "constant" };
      return expr.value === p.value;
    }

    case "variable": {
      const p = pattern as Expression<unknown> & { kind: "variable" };
      return expr.name === p.name;
    }

    case "binary": {
      const p = pattern as PatternBinary;
      return (
        expr.op === p.op &&
        matchInternal(expr.left, p.left, bindings) &&
        matchInternal(expr.right, p.right, bindings)
      );
    }

    case "unary": {
      const p = pattern as PatternUnary;
      return expr.op === p.op && matchInternal(expr.arg, p.arg, bindings);
    }

    case "function": {
      const p = pattern as PatternFunction;
      return expr.fn === p.fn && matchInternal(expr.arg, p.arg, bindings);
    }

    default:
      return false;
  }
}

function isPatternVariable(p: Pattern): p is PatternVariable {
  return (p as PatternVariable).kind === "pattern-variable";
}

function matchPatternVariable(
  expr: Expression<unknown>,
  pattern: PatternVariable,
  bindings: MatchBindings
): boolean {
  if (pattern.constraint === "constant" && !isConstant(expr)) {
    return false;
  }
  if (pattern.constraint === "variable" && !isVariable(expr)) {
    return false;
  }

  const existing = bindings.get(pattern.name);
  if (existing !== undefined) {
    return expressionsEqualForMatch(expr, existing);
  }

  bindings.set(pattern.name, expr);
  return true;
}

function expressionsEqualForMatch(
  a: Expression<unknown>,
  b: Expression<unknown>
): boolean {
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "constant":
      return a.value === (b as typeof a).value;
    case "variable":
      return a.name === (b as typeof a).name;
    case "binary": {
      const bb = b as typeof a;
      return (
        a.op === bb.op &&
        expressionsEqualForMatch(a.left, bb.left) &&
        expressionsEqualForMatch(a.right, bb.right)
      );
    }
    case "unary": {
      const bu = b as typeof a;
      return a.op === bu.op && expressionsEqualForMatch(a.arg, bu.arg);
    }
    case "function": {
      const bf = b as typeof a;
      return a.fn === bf.fn && expressionsEqualForMatch(a.arg, bf.arg);
    }
    default:
      return false;
  }
}

/**
 * A rewrite rule: pattern => replacement
 */
export interface RewriteRule {
  readonly pattern: Pattern;
  readonly replacement: Pattern;
  readonly condition?: (bindings: MatchBindings) => boolean;
}

/**
 * Create a rewrite rule.
 */
export function rule(
  pattern: Pattern,
  replacement: Pattern,
  condition?: (bindings: MatchBindings) => boolean
): RewriteRule {
  return { pattern, replacement, condition };
}

/**
 * Apply a rewrite rule to an expression.
 */
export function applyRule(
  expr: Expression<unknown>,
  r: RewriteRule
): Expression<unknown> | null {
  const bindings = match(expr, r.pattern);

  if (bindings === null) {
    return null;
  }

  if (r.condition && !r.condition(bindings)) {
    return null;
  }

  return substitute(r.replacement, bindings);
}

function substitute(pattern: Pattern, bindings: MatchBindings): Expression<unknown> {
  if (isPatternVariable(pattern)) {
    const bound = bindings.get(pattern.name);
    if (bound === undefined) {
      throw new Error(`Unbound pattern variable: ${pattern.name}`);
    }
    return bound;
  }

  switch (pattern.kind) {
    case "constant":
    case "variable":
      return pattern as Expression<unknown>;

    case "binary": {
      const p = pattern as PatternBinary;
      return {
        kind: "binary",
        op: p.op,
        left: substitute(p.left, bindings),
        right: substitute(p.right, bindings),
      };
    }

    case "unary": {
      const p = pattern as PatternUnary;
      return {
        kind: "unary",
        op: p.op,
        arg: substitute(p.arg, bindings),
      };
    }

    case "function": {
      const p = pattern as PatternFunction;
      return {
        kind: "function",
        fn: p.fn,
        arg: substitute(p.arg, bindings),
      };
    }

    default:
      return pattern as Expression<unknown>;
  }
}

/**
 * Apply rewrite rules exhaustively until no more rules apply.
 */
export function rewrite(
  expr: Expression<unknown>,
  rules: RewriteRule[],
  maxIterations: number = 100
): Expression<unknown> {
  let current = expr;
  let iterations = 0;

  while (iterations < maxIterations) {
    const rewritten = rewriteOnce(current, rules);

    if (rewritten === null) {
      break;
    }

    current = rewritten;
    iterations++;
  }

  return current;
}

function rewriteOnce(
  expr: Expression<unknown>,
  rules: RewriteRule[]
): Expression<unknown> | null {
  for (const r of rules) {
    const result = applyRule(expr, r);
    if (result !== null) {
      return result;
    }
  }

  switch (expr.kind) {
    case "constant":
    case "variable":
      return null;

    case "binary": {
      const leftRewritten = rewriteOnce(expr.left, rules);
      if (leftRewritten !== null) {
        return { ...expr, left: leftRewritten };
      }
      const rightRewritten = rewriteOnce(expr.right, rules);
      if (rightRewritten !== null) {
        return { ...expr, right: rightRewritten };
      }
      return null;
    }

    case "unary":
    case "function": {
      const argRewritten = rewriteOnce(expr.arg, rules);
      if (argRewritten !== null) {
        return { ...expr, arg: argRewritten };
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Find all subexpressions matching a pattern.
 */
export function findAll(
  expr: Expression<unknown>,
  pattern: Pattern
): Array<{ expr: Expression<unknown>; bindings: MatchBindings }> {
  const results: Array<{ expr: Expression<unknown>; bindings: MatchBindings }> = [];

  function search(e: Expression<unknown>): void {
    const bindings = match(e, pattern);
    if (bindings !== null) {
      results.push({ expr: e, bindings });
    }

    switch (e.kind) {
      case "binary":
        search(e.left);
        search(e.right);
        break;
      case "unary":
      case "function":
        search(e.arg);
        break;
    }
  }

  search(expr);
  return results;
}
