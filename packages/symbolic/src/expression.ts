/**
 * Expression AST for Symbolic Mathematics
 *
 * A type-safe symbolic expression system where Expression<T> tracks
 * the result type T at compile time.
 *
 * @example
 * ```typescript
 * const x = var_("x");           // Expression<number>
 * const expr = mul(x, x);        // Expression<number>
 * const result = evaluate(expr, { x: 5 }); // 25
 * ```
 */

import type {
  BinaryOpSymbol,
  UnaryOpSymbol,
  FunctionName,
  Mul,
  Div,
  Add,
  Sub,
  Pow,
  Sqrt,
} from "./types.js";

// ============================================================================
// AST Node Types
// ============================================================================

/**
 * A numeric constant in the expression tree.
 */
export interface Constant<T = number> {
  readonly kind: "constant";
  readonly value: number;
  readonly name?: string;
  readonly _type?: T;
}

/**
 * A symbolic variable.
 */
export interface Variable<T = number> {
  readonly kind: "variable";
  readonly name: string;
  readonly _type?: T;
}

/**
 * A binary operation node.
 */
export interface BinaryOp<A = number, B = number, R = number> {
  readonly kind: "binary";
  readonly op: BinaryOpSymbol;
  readonly left: Expression<A>;
  readonly right: Expression<B>;
  readonly _type?: R;
}

/**
 * A unary operation node.
 */
export interface UnaryOp<A = number, R = number> {
  readonly kind: "unary";
  readonly op: UnaryOpSymbol;
  readonly arg: Expression<A>;
  readonly _type?: R;
}

/**
 * A function call node.
 */
export interface FunctionCall<A = number, R = number> {
  readonly kind: "function";
  readonly fn: FunctionName;
  readonly arg: Expression<A>;
  readonly _type?: R;
}

/**
 * A derivative expression (symbolic, not yet computed).
 */
export interface Derivative<T = number> {
  readonly kind: "derivative";
  readonly expr: Expression<T>;
  readonly variable: string;
  readonly order: number;
  readonly _type?: T;
}

/**
 * An integral expression (symbolic, not yet computed).
 */
export interface Integral<T = number> {
  readonly kind: "integral";
  readonly expr: Expression<T>;
  readonly variable: string;
  readonly _type?: T;
}

/**
 * A limit expression.
 */
export interface Limit<T = number> {
  readonly kind: "limit";
  readonly expr: Expression<T>;
  readonly variable: string;
  readonly approaching: number;
  readonly direction?: "left" | "right" | "both";
  readonly _type?: T;
}

/**
 * An equation (left = right).
 */
export interface Equation<T = number> {
  readonly kind: "equation";
  readonly left: Expression<T>;
  readonly right: Expression<T>;
  readonly _type?: T;
}

/**
 * A sum expression (Σ).
 */
export interface Sum<T = number> {
  readonly kind: "sum";
  readonly expr: Expression<T>;
  readonly variable: string;
  readonly from: Expression<number>;
  readonly to: Expression<number>;
  readonly _type?: T;
}

/**
 * A product expression (Π).
 */
export interface Product<T = number> {
  readonly kind: "product";
  readonly expr: Expression<T>;
  readonly variable: string;
  readonly from: Expression<number>;
  readonly to: Expression<number>;
  readonly _type?: T;
}

// ============================================================================
// Expression Union Type
// ============================================================================

/**
 * A symbolic mathematical expression with compile-time type tracking.
 *
 * The type parameter T represents the result type when the expression
 * is evaluated. For plain numbers, T is `number`. When used with
 * @typesugar/units, T can track physical dimensions.
 */
export type Expression<T = number> =
  | Constant<T>
  | Variable<T>
  | BinaryOp<unknown, unknown, T>
  | UnaryOp<unknown, T>
  | FunctionCall<unknown, T>
  | Derivative<T>
  | Integral<T>
  | Limit<T>
  | Equation<T>
  | Sum<T>
  | Product<T>;

// ============================================================================
// Type Guards
// ============================================================================

export function isConstant<T>(expr: Expression<T>): expr is Constant<T> {
  return expr.kind === "constant";
}

export function isVariable<T>(expr: Expression<T>): expr is Variable<T> {
  return expr.kind === "variable";
}

export function isBinaryOp<T>(expr: Expression<T>): expr is BinaryOp<unknown, unknown, T> {
  return expr.kind === "binary";
}

export function isUnaryOp<T>(expr: Expression<T>): expr is UnaryOp<unknown, T> {
  return expr.kind === "unary";
}

export function isFunctionCall<T>(expr: Expression<T>): expr is FunctionCall<unknown, T> {
  return expr.kind === "function";
}

export function isDerivative<T>(expr: Expression<T>): expr is Derivative<T> {
  return expr.kind === "derivative";
}

export function isIntegral<T>(expr: Expression<T>): expr is Integral<T> {
  return expr.kind === "integral";
}

export function isLimit<T>(expr: Expression<T>): expr is Limit<T> {
  return expr.kind === "limit";
}

export function isEquation<T>(expr: Expression<T>): expr is Equation<T> {
  return expr.kind === "equation";
}

export function isSum<T>(expr: Expression<T>): expr is Sum<T> {
  return expr.kind === "sum";
}

export function isProduct<T>(expr: Expression<T>): expr is Product<T> {
  return expr.kind === "product";
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if an expression is a constant with a specific value.
 */
export function isConstantValue<T>(expr: Expression<T>, value: number): boolean {
  return isConstant(expr) && expr.value === value;
}

/**
 * Check if an expression is zero.
 */
export function isZero<T>(expr: Expression<T>): boolean {
  return isConstantValue(expr, 0);
}

/**
 * Check if an expression is one.
 */
export function isOne<T>(expr: Expression<T>): boolean {
  return isConstantValue(expr, 1);
}

/**
 * Check if an expression is negative one.
 */
export function isNegativeOne<T>(expr: Expression<T>): boolean {
  return isConstantValue(expr, -1);
}

/**
 * Get all variable names used in an expression.
 */
export function getVariables<T>(expr: Expression<T>): Set<string> {
  const vars = new Set<string>();

  function collect(e: Expression<unknown>): void {
    switch (e.kind) {
      case "constant":
        break;
      case "variable":
        vars.add(e.name);
        break;
      case "binary":
        collect(e.left);
        collect(e.right);
        break;
      case "unary":
      case "function":
        collect(e.arg);
        break;
      case "derivative":
      case "integral":
        collect(e.expr);
        break;
      case "limit":
        collect(e.expr);
        break;
      case "equation":
        collect(e.left);
        collect(e.right);
        break;
      case "sum":
      case "product":
        collect(e.expr);
        collect(e.from);
        collect(e.to);
        break;
    }
  }

  collect(expr);
  return vars;
}

/**
 * Check if an expression contains a specific variable.
 */
export function hasVariable<T>(expr: Expression<T>, varName: string): boolean {
  return getVariables(expr).has(varName);
}

/**
 * Check if an expression is purely constant (contains no variables).
 */
export function isPureConstant<T>(expr: Expression<T>): boolean {
  return getVariables(expr).size === 0;
}

/**
 * Count the depth of the expression tree.
 */
export function depth<T>(expr: Expression<T>): number {
  switch (expr.kind) {
    case "constant":
    case "variable":
      return 1;
    case "binary":
      return 1 + Math.max(depth(expr.left), depth(expr.right));
    case "unary":
    case "function":
      return 1 + depth(expr.arg);
    case "derivative":
    case "integral":
      return 1 + depth(expr.expr);
    case "limit":
      return 1 + depth(expr.expr);
    case "equation":
      return 1 + Math.max(depth(expr.left), depth(expr.right));
    case "sum":
    case "product":
      return 1 + Math.max(depth(expr.expr), depth(expr.from), depth(expr.to));
  }
}

/**
 * Count the number of nodes in the expression tree.
 */
export function nodeCount<T>(expr: Expression<T>): number {
  switch (expr.kind) {
    case "constant":
    case "variable":
      return 1;
    case "binary":
      return 1 + nodeCount(expr.left) + nodeCount(expr.right);
    case "unary":
    case "function":
      return 1 + nodeCount(expr.arg);
    case "derivative":
    case "integral":
      return 1 + nodeCount(expr.expr);
    case "limit":
      return 1 + nodeCount(expr.expr);
    case "equation":
      return 1 + nodeCount(expr.left) + nodeCount(expr.right);
    case "sum":
    case "product":
      return 1 + nodeCount(expr.expr) + nodeCount(expr.from) + nodeCount(expr.to);
  }
}
