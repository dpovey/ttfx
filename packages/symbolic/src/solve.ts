/**
 * Equation Solving
 *
 * Solve equations for a specific variable using algebraic manipulation.
 */

import type { Expression } from "./expression.js";
import { const_, add, sub, ZERO } from "./builders.js";
import { isConstant, isVariable, isBinaryOp, hasVariable, isEquation } from "./expression.js";
import { simplify } from "./simplify/simplify.js";
import { evaluate } from "./eval.js";

type Expr = Expression<number>;

export type SolveResult<T> =
  | { success: true; solutions: Expression<T>[] }
  | { success: false; reason: string };

/**
 * Solve an equation for a variable.
 */
export function solve<T>(eq: Expression<T>, variable: string): SolveResult<T> {
  try {
    const equation = isEquation(eq) ? eq : { kind: "equation" as const, left: eq, right: ZERO };

    const expr = simplify(sub(equation.left as Expr, equation.right as Expr));

    if (!hasVariable(expr, variable)) {
      try {
        const val = evaluate(expr, {});
        if (Math.abs(val) < 1e-10) {
          return { success: true, solutions: [] as Expression<T>[] };
        }
        return { success: false, reason: "No solution exists" };
      } catch {
        return { success: false, reason: `Variable '${variable}' not in equation` };
      }
    }

    const solutions = solveInternal(expr, variable);
    return {
      success: true,
      solutions: solutions.map((s) => simplify(s) as Expression<T>),
    };
  } catch (e) {
    return {
      success: false,
      reason: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

function solveInternal(expr: Expression<unknown>, v: string): Expression<unknown>[] {
  const degree = getPolynomialDegree(expr, v);

  if (degree === 1) {
    return solveLinear(expr, v);
  }

  if (degree === 2) {
    return solveQuadratic(expr, v);
  }

  return solveByIsolation(expr, v);
}

function getPolynomialDegree(expr: Expression<unknown>, v: string): number {
  switch (expr.kind) {
    case "constant":
      return 0;

    case "variable":
      return expr.name === v ? 1 : 0;

    case "binary":
      switch (expr.op) {
        case "+":
        case "-":
          return Math.max(getPolynomialDegree(expr.left, v), getPolynomialDegree(expr.right, v));
        case "*": {
          const leftDeg = getPolynomialDegree(expr.left, v);
          const rightDeg = getPolynomialDegree(expr.right, v);
          if (leftDeg < 0 || rightDeg < 0) return -1;
          return leftDeg + rightDeg;
        }
        case "^":
          if (hasVariable(expr.right, v)) return -1;
          if (isConstant(expr.right)) {
            const exp = expr.right.value;
            if (Number.isInteger(exp) && exp >= 0) {
              const baseDeg = getPolynomialDegree(expr.left, v);
              return baseDeg < 0 ? -1 : baseDeg * exp;
            }
          }
          return -1;
        case "/":
          if (hasVariable(expr.right, v)) return -1;
          return getPolynomialDegree(expr.left, v);
      }
      break;

    case "unary":
      if (expr.op === "-") {
        return getPolynomialDegree(expr.arg, v);
      }
      return hasVariable(expr, v) ? -1 : 0;

    default:
      return hasVariable(expr, v) ? -1 : 0;
  }

  return -1;
}

function solveLinear(expr: Expression<unknown>, v: string): Expression<unknown>[] {
  const { a, b } = extractLinearCoefficients(expr, v);

  if (a === 0) {
    if (b === 0) {
      return [];
    }
    throw new Error("No solution: constant equation");
  }

  return [const_(-b / a)];
}

function extractLinearCoefficients(expr: Expression<unknown>, v: string): { a: number; b: number } {
  let a = 0;
  let b = 0;

  function extract(e: Expression<unknown>, sign: number): void {
    switch (e.kind) {
      case "constant":
        b += sign * e.value;
        break;

      case "variable":
        if (e.name === v) {
          a += sign;
        } else {
          throw new Error(`Multiple variables in equation`);
        }
        break;

      case "binary":
        if (e.op === "+") {
          extract(e.left, sign);
          extract(e.right, sign);
        } else if (e.op === "-") {
          extract(e.left, sign);
          extract(e.right, -sign);
        } else if (e.op === "*") {
          if (isConstant(e.left) && isVariable(e.right) && e.right.name === v) {
            a += sign * e.left.value;
          } else if (isConstant(e.right) && isVariable(e.left) && e.left.name === v) {
            a += sign * e.right.value;
          } else if (isConstant(e.left) && isConstant(e.right)) {
            b += sign * e.left.value * e.right.value;
          } else {
            throw new Error("Cannot extract linear coefficients from this expression");
          }
        } else {
          throw new Error(`Cannot handle operator ${e.op} in linear extraction`);
        }
        break;

      case "unary":
        if (e.op === "-") {
          extract(e.arg, -sign);
        } else {
          throw new Error(`Cannot handle unary ${e.op} in linear extraction`);
        }
        break;

      default:
        throw new Error(`Cannot extract linear coefficients from ${e.kind}`);
    }
  }

  extract(expr, 1);
  return { a, b };
}

function solveQuadratic(expr: Expression<unknown>, v: string): Expression<unknown>[] {
  const { a, b, c } = extractQuadraticCoefficients(expr, v);

  if (a === 0) {
    if (b === 0) {
      if (c === 0) return [];
      throw new Error("No solution");
    }
    return [const_(-c / b)];
  }

  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    throw new Error("No real solutions (discriminant < 0)");
  }

  if (Math.abs(discriminant) < 1e-10) {
    return [const_(-b / (2 * a))];
  }

  const sqrtD = Math.sqrt(discriminant);
  return [const_((-b + sqrtD) / (2 * a)), const_((-b - sqrtD) / (2 * a))];
}

function extractQuadraticCoefficients(
  expr: Expression<unknown>,
  v: string
): { a: number; b: number; c: number } {
  let a = 0;
  let b = 0;
  let c = 0;

  function extract(e: Expression<unknown>, sign: number): void {
    switch (e.kind) {
      case "constant":
        c += sign * e.value;
        break;

      case "variable":
        if (e.name === v) {
          b += sign;
        } else {
          throw new Error("Multiple variables in equation");
        }
        break;

      case "binary":
        if (e.op === "+") {
          extract(e.left, sign);
          extract(e.right, sign);
        } else if (e.op === "-") {
          extract(e.left, sign);
          extract(e.right, -sign);
        } else if (e.op === "*") {
          extractProduct(e.left, e.right, sign);
        } else if (e.op === "^") {
          if (
            isVariable(e.left) &&
            e.left.name === v &&
            isConstant(e.right) &&
            e.right.value === 2
          ) {
            a += sign;
          } else if (!hasVariable(e, v)) {
            c += sign * evaluate(e, {});
          } else {
            throw new Error("Cannot extract quadratic coefficients");
          }
        } else {
          throw new Error(`Cannot handle operator ${e.op}`);
        }
        break;

      case "unary":
        if (e.op === "-") {
          extract(e.arg, -sign);
        } else {
          throw new Error(`Cannot handle unary ${e.op}`);
        }
        break;

      default:
        throw new Error(`Cannot extract quadratic coefficients from ${e.kind}`);
    }
  }

  function extractProduct(
    left: Expression<unknown>,
    right: Expression<unknown>,
    sign: number
  ): void {
    if (isConstant(left) && isVariable(right) && right.name === v) {
      b += sign * left.value;
      return;
    }
    if (isConstant(right) && isVariable(left) && left.name === v) {
      b += sign * right.value;
      return;
    }

    if (isConstant(left) && isBinaryOp(right) && right.op === "^") {
      if (
        isVariable(right.left) &&
        right.left.name === v &&
        isConstant(right.right) &&
        right.right.value === 2
      ) {
        a += sign * left.value;
        return;
      }
    }
    if (isConstant(right) && isBinaryOp(left) && left.op === "^") {
      if (
        isVariable(left.left) &&
        left.left.name === v &&
        isConstant(left.right) &&
        left.right.value === 2
      ) {
        a += sign * right.value;
        return;
      }
    }

    if (isVariable(left) && isVariable(right) && left.name === v && right.name === v) {
      a += sign;
      return;
    }

    if (isConstant(left) && isConstant(right)) {
      c += sign * left.value * right.value;
      return;
    }

    throw new Error("Cannot extract quadratic coefficients from product");
  }

  extract(expr, 1);
  return { a, b, c };
}

function solveByIsolation(expr: Expression<unknown>, v: string): Expression<unknown>[] {
  const simplified = simplify(expr);

  if (isVariable(simplified) && simplified.name === v) {
    return [ZERO];
  }

  const solutions = numericalSolve(simplified, v);
  if (solutions.length > 0) {
    return solutions;
  }

  throw new Error("Cannot solve this equation. Try simplifying or using numerical methods.");
}

function numericalSolve(
  expr: Expression<unknown>,
  v: string,
  initialGuesses: number[] = [-10, -1, 0, 1, 10]
): Expression<unknown>[] {
  const solutions: number[] = [];
  const tolerance = 1e-10;
  const maxIterations = 100;

  function f(x: number): number {
    return evaluate(expr, { [v]: x });
  }

  function df(x: number): number {
    const h = 1e-8;
    return (f(x + h) - f(x - h)) / (2 * h);
  }

  for (const guess of initialGuesses) {
    let x = guess;

    for (let i = 0; i < maxIterations; i++) {
      const fx = f(x);
      const dfx = df(x);

      if (Math.abs(fx) < tolerance) {
        const alreadyFound = solutions.some((s) => Math.abs(s - x) < tolerance * 1000);
        if (!alreadyFound) {
          solutions.push(x);
        }
        break;
      }

      if (Math.abs(dfx) < tolerance) {
        break;
      }

      x = x - fx / dfx;

      if (!Number.isFinite(x)) {
        break;
      }
    }
  }

  return solutions.map((x) => const_(x));
}

/**
 * Solve a system of linear equations.
 */
export function solveSystem(
  equations: Array<{ left: Expression<unknown>; right: Expression<unknown> }>,
  variables: string[]
): Map<string, Expression<unknown>> | null {
  if (equations.length !== variables.length) {
    throw new Error("Number of equations must equal number of variables");
  }

  if (equations.length === 1) {
    const result = solve(
      { kind: "equation", left: equations[0].left, right: equations[0].right },
      variables[0]
    );
    if (!result.success || result.solutions.length === 0) {
      return null;
    }
    const map = new Map<string, Expression<unknown>>();
    map.set(variables[0], result.solutions[0]);
    return map;
  }

  if (equations.length === 2) {
    return solve2x2System(equations, variables);
  }

  throw new Error("Systems with more than 2 equations not yet supported");
}

function solve2x2System(
  equations: Array<{ left: Expression<unknown>; right: Expression<unknown> }>,
  [v1, v2]: string[]
): Map<string, Expression<unknown>> | null {
  const expr1 = simplify(sub(equations[0].left as Expr, equations[0].right as Expr));
  const expr2 = simplify(sub(equations[1].left as Expr, equations[1].right as Expr));

  try {
    const { a: a1, b: b1 } = extractTwoVarLinear(expr1, v1, v2);
    const { a: a2, b: b2 } = extractTwoVarLinear(expr2, v1, v2);
    const c1 = -extractConstant(expr1, v1, v2);
    const c2 = -extractConstant(expr2, v1, v2);

    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-10) {
      return null;
    }

    const x = (c1 * b2 - c2 * b1) / det;
    const y = (a1 * c2 - a2 * c1) / det;

    const result = new Map<string, Expression<unknown>>();
    result.set(v1, const_(x));
    result.set(v2, const_(y));
    return result;
  } catch {
    return null;
  }
}

function extractTwoVarLinear(
  expr: Expression<unknown>,
  v1: string,
  v2: string
): { a: number; b: number } {
  let a = 0;
  let b = 0;

  function extract(e: Expression<unknown>, sign: number): void {
    switch (e.kind) {
      case "constant":
        break;
      case "variable":
        if (e.name === v1) a += sign;
        else if (e.name === v2) b += sign;
        break;
      case "binary":
        if (e.op === "+") {
          extract(e.left, sign);
          extract(e.right, sign);
        } else if (e.op === "-") {
          extract(e.left, sign);
          extract(e.right, -sign);
        } else if (e.op === "*") {
          if (isConstant(e.left) && isVariable(e.right)) {
            if (e.right.name === v1) a += sign * e.left.value;
            else if (e.right.name === v2) b += sign * e.left.value;
          } else if (isConstant(e.right) && isVariable(e.left)) {
            if (e.left.name === v1) a += sign * e.right.value;
            else if (e.left.name === v2) b += sign * e.right.value;
          }
        }
        break;
      case "unary":
        if (e.op === "-") extract(e.arg, -sign);
        break;
    }
  }

  extract(expr, 1);
  return { a, b };
}

function extractConstant(expr: Expression<unknown>, _v1: string, _v2: string): number {
  let c = 0;

  function extract(e: Expression<unknown>, sign: number): void {
    switch (e.kind) {
      case "constant":
        c += sign * e.value;
        break;
      case "binary":
        if (e.op === "+") {
          extract(e.left, sign);
          extract(e.right, sign);
        } else if (e.op === "-") {
          extract(e.left, sign);
          extract(e.right, -sign);
        } else if (e.op === "*" && isConstant(e.left) && isConstant(e.right)) {
          c += sign * e.left.value * e.right.value;
        }
        break;
      case "unary":
        if (e.op === "-") extract(e.arg, -sign);
        break;
    }
  }

  extract(expr, 1);
  return c;
}
