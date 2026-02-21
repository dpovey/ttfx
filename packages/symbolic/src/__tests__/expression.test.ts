import { describe, it, expect } from "vitest";
import {
  var_,
  const_,
  add,
  sub,
  mul,
  div,
  pow,
  neg,
  sin,
  cos,
  exp,
  ln,
  sqrt,
  ZERO,
  ONE,
  PI,
  E,
} from "../builders.js";
import {
  isConstant,
  isVariable,
  isBinaryOp,
  isZero,
  isOne,
  getVariables,
  hasVariable,
  isPureConstant,
  depth,
  nodeCount,
} from "../expression.js";

describe("Expression AST", () => {
  describe("builders", () => {
    it("creates constants", () => {
      const c = const_(42);
      expect(c.kind).toBe("constant");
      expect(c.value).toBe(42);
    });

    it("creates named constants", () => {
      expect(PI.name).toBe("π");
      expect(PI.value).toBeCloseTo(Math.PI);
      expect(E.name).toBe("e");
      expect(E.value).toBeCloseTo(Math.E);
    });

    it("creates variables", () => {
      const x = var_("x");
      expect(x.kind).toBe("variable");
      expect(x.name).toBe("x");
    });

    it("creates binary operations", () => {
      const x = var_("x");
      const expr = add(x, const_(1));
      expect(expr.kind).toBe("binary");
      expect(expr.op).toBe("+");
    });

    it("creates unary operations", () => {
      const x = var_("x");
      const expr = neg(x);
      expect(expr.kind).toBe("unary");
      expect(expr.op).toBe("-");
    });

    it("creates function calls", () => {
      const x = var_("x");
      const expr = sin(x);
      expect(expr.kind).toBe("function");
      expect(expr.fn).toBe("sin");
    });
  });

  describe("type guards", () => {
    it("isConstant", () => {
      expect(isConstant(const_(1))).toBe(true);
      expect(isConstant(var_("x"))).toBe(false);
    });

    it("isVariable", () => {
      expect(isVariable(var_("x"))).toBe(true);
      expect(isVariable(const_(1))).toBe(false);
    });

    it("isBinaryOp", () => {
      const x = var_("x");
      expect(isBinaryOp(add(x, x))).toBe(true);
      expect(isBinaryOp(neg(x))).toBe(false);
    });

    it("isZero and isOne", () => {
      expect(isZero(ZERO)).toBe(true);
      expect(isZero(const_(0))).toBe(true);
      expect(isZero(const_(1))).toBe(false);
      expect(isOne(ONE)).toBe(true);
      expect(isOne(const_(1))).toBe(true);
      expect(isOne(const_(0))).toBe(false);
    });
  });

  describe("utilities", () => {
    it("getVariables", () => {
      const x = var_("x");
      const y = var_("y");
      const expr = add(mul(x, y), pow(x, const_(2)));
      const vars = getVariables(expr);
      expect(vars.has("x")).toBe(true);
      expect(vars.has("y")).toBe(true);
      expect(vars.size).toBe(2);
    });

    it("hasVariable", () => {
      const x = var_("x");
      const expr = mul(x, const_(2));
      expect(hasVariable(expr, "x")).toBe(true);
      expect(hasVariable(expr, "y")).toBe(false);
    });

    it("isPureConstant", () => {
      expect(isPureConstant(const_(42))).toBe(true);
      expect(isPureConstant(add(const_(1), const_(2)))).toBe(true);
      expect(isPureConstant(var_("x"))).toBe(false);
      expect(isPureConstant(add(var_("x"), const_(1)))).toBe(false);
    });

    it("depth", () => {
      const x = var_("x");
      expect(depth(x)).toBe(1);
      expect(depth(add(x, const_(1)))).toBe(2);
      expect(depth(add(mul(x, x), const_(1)))).toBe(3);
    });

    it("nodeCount", () => {
      const x = var_("x");
      expect(nodeCount(x)).toBe(1);
      expect(nodeCount(add(x, const_(1)))).toBe(3);
    });
  });
});
