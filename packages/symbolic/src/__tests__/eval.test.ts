import { describe, it, expect } from "vitest";
import { var_, const_, add, sub, mul, div, pow, sin, cos, exp, ln, sqrt, sum, product } from "../builders.js";
import { evaluate, partialEvaluate, canEvaluate } from "../eval.js";

describe("Evaluation", () => {
  const x = var_("x");
  const y = var_("y");

  describe("evaluate", () => {
    it("evaluates constants", () => {
      expect(evaluate(const_(42), {})).toBe(42);
    });

    it("evaluates variables", () => {
      expect(evaluate(x, { x: 5 })).toBe(5);
    });

    it("evaluates addition", () => {
      expect(evaluate(add(x, const_(3)), { x: 2 })).toBe(5);
    });

    it("evaluates subtraction", () => {
      expect(evaluate(sub(x, const_(3)), { x: 5 })).toBe(2);
    });

    it("evaluates multiplication", () => {
      expect(evaluate(mul(x, const_(3)), { x: 4 })).toBe(12);
    });

    it("evaluates division", () => {
      expect(evaluate(div(x, const_(2)), { x: 10 })).toBe(5);
    });

    it("evaluates powers", () => {
      expect(evaluate(pow(x, const_(2)), { x: 3 })).toBe(9);
      expect(evaluate(pow(const_(2), x), { x: 3 })).toBe(8);
    });

    it("evaluates trigonometric functions", () => {
      expect(evaluate(sin(const_(0)), {})).toBe(0);
      expect(evaluate(cos(const_(0)), {})).toBe(1);
    });

    it("evaluates exponential and logarithm", () => {
      expect(evaluate(exp(const_(0)), {})).toBe(1);
      expect(evaluate(ln(const_(1)), {})).toBe(0);
    });

    it("evaluates complex expressions", () => {
      const expr = add(mul(x, x), mul(const_(2), x));
      expect(evaluate(expr, { x: 3 })).toBe(15); // 9 + 6
    });

    it("throws for unbound variables in strict mode", () => {
      expect(() => evaluate(x, {})).toThrow("not bound");
    });

    it("uses default value for unbound variables in non-strict mode", () => {
      expect(evaluate(x, {}, { strict: false, defaultValue: 0 })).toBe(0);
    });

    it("throws for division by zero", () => {
      expect(() => evaluate(div(const_(1), const_(0)), {})).toThrow("Division by zero");
    });
  });

  describe("summation and product", () => {
    it("evaluates summation", () => {
      const i = var_("i");
      // Σ(i) from i=1 to 5 = 1+2+3+4+5 = 15
      const expr = sum(i, "i", const_(1), const_(5));
      expect(evaluate(expr, {})).toBe(15);
    });

    it("evaluates summation with x", () => {
      const i = var_("i");
      // Σ(i*x) from i=1 to 3 = x + 2x + 3x = 6x
      const expr = sum(mul(i, x), "i", const_(1), const_(3));
      expect(evaluate(expr, { x: 2 })).toBe(12);
    });

    it("evaluates product", () => {
      const i = var_("i");
      // Π(i) from i=1 to 5 = 5! = 120
      const expr = product(i, "i", const_(1), const_(5));
      expect(evaluate(expr, {})).toBe(120);
    });
  });

  describe("partialEvaluate", () => {
    it("substitutes bound variables", () => {
      const expr = add(x, y);
      const result = partialEvaluate(expr, { x: 5 });
      expect(result.kind).toBe("binary");
      if (result.kind === "binary") {
        expect(result.left.kind).toBe("constant");
        expect(result.right.kind).toBe("variable");
      }
    });

    it("folds constants", () => {
      const expr = add(x, add(const_(1), const_(2)));
      const result = partialEvaluate(expr, {});
      expect(result.kind).toBe("binary");
      if (result.kind === "binary") {
        expect(result.right.kind).toBe("constant");
        if (result.right.kind === "constant") {
          expect(result.right.value).toBe(3);
        }
      }
    });
  });

  describe("canEvaluate", () => {
    it("returns true for bound expressions", () => {
      expect(canEvaluate(add(x, y), { x: 1, y: 2 })).toBe(true);
    });

    it("returns false for unbound expressions", () => {
      expect(canEvaluate(add(x, y), { x: 1 })).toBe(false);
    });

    it("returns true for pure constants", () => {
      expect(canEvaluate(add(const_(1), const_(2)), {})).toBe(true);
    });
  });
});
