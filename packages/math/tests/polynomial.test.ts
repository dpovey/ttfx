import { describe, it, expect } from "vitest";
import {
  polynomial,
  constant,
  monomial,
  zeroPoly,
  onePoly,
  xPoly,
  degree,
  isZeroPoly,
  leading,
  coeff,
  evaluate,
  addPoly,
  subPoly,
  mulPoly,
  negatePoly,
  scalePoly,
  derivative,
  polyIntegral,
  nthDerivative,
  divPoly,
  gcdPoly,
  rationalRoots,
  numericPolynomial,
  polyEquals,
  polyToString,
  composePoly,
} from "../src/index.js";
import { numericNumber, fractionalNumber } from "@typesugar/std";

const N = numericNumber;
const F = fractionalNumber;

describe("Polynomial", () => {
  describe("constructors", () => {
    it("creates polynomial from coefficients", () => {
      const p = polynomial([1, 2, 3]);
      expect(p.coeffs).toEqual([1, 2, 3]);
    });

    it("trims trailing zeros", () => {
      const p = polynomial([1, 2, 0, 0]);
      expect(p.coeffs).toEqual([1, 2]);
    });

    it("creates constant polynomial", () => {
      const p = constant(5);
      expect(p.coeffs).toEqual([5]);
    });

    it("constant zero is empty", () => {
      const p = constant(0);
      expect(p.coeffs).toEqual([]);
    });

    it("creates monomial", () => {
      const p = monomial(3, 2, 0);
      expect(p.coeffs).toEqual([0, 0, 3]);
    });

    it("creates zero polynomial", () => {
      const p = zeroPoly<number>();
      expect(p.coeffs).toEqual([]);
    });

    it("creates one polynomial", () => {
      const p = onePoly(N);
      expect(p.coeffs).toEqual([1]);
    });

    it("creates x polynomial", () => {
      const p = xPoly(N);
      expect(p.coeffs).toEqual([0, 1]);
    });
  });

  describe("queries", () => {
    it("degree", () => {
      expect(degree(polynomial([1, 2, 3]))).toBe(2);
      expect(degree(polynomial([5]))).toBe(0);
      expect(degree(zeroPoly())).toBe(-1);
    });

    it("isZero", () => {
      expect(isZeroPoly(zeroPoly())).toBe(true);
      expect(isZeroPoly(polynomial([0]))).toBe(true);
      expect(isZeroPoly(polynomial([1]))).toBe(false);
    });

    it("leading coefficient", () => {
      expect(leading(polynomial([1, 2, 3]))).toBe(3);
      expect(leading(polynomial([5]))).toBe(5);
      expect(leading(zeroPoly())).toBeUndefined();
    });

    it("coeff", () => {
      const p = polynomial([1, 2, 3]);
      expect(coeff(p, 0, N)).toBe(1);
      expect(coeff(p, 1, N)).toBe(2);
      expect(coeff(p, 2, N)).toBe(3);
      expect(coeff(p, 5, N)).toBe(0);
    });
  });

  describe("evaluate", () => {
    it("evaluates polynomial at a point", () => {
      const p = polynomial([1, 2, 3]);
      expect(evaluate(p, 2, N)).toBe(17);
    });

    it("evaluates constant polynomial", () => {
      const p = constant(5);
      expect(evaluate(p, 100, N)).toBe(5);
    });

    it("evaluates zero polynomial", () => {
      expect(evaluate(zeroPoly(), 100, N)).toBe(0);
    });

    it("evaluates x polynomial", () => {
      const p = xPoly(N);
      expect(evaluate(p, 7, N)).toBe(7);
    });
  });

  describe("arithmetic", () => {
    it("adds polynomials", () => {
      const a = polynomial([1, 2, 3]);
      const b = polynomial([4, 5]);
      const sum = addPoly(a, b, N);
      expect(sum.coeffs).toEqual([5, 7, 3]);
    });

    it("adds with zero", () => {
      const p = polynomial([1, 2, 3]);
      expect(addPoly(p, zeroPoly(), N).coeffs).toEqual([1, 2, 3]);
      expect(addPoly(zeroPoly(), p, N).coeffs).toEqual([1, 2, 3]);
    });

    it("subtracts polynomials", () => {
      const a = polynomial([5, 7, 3]);
      const b = polynomial([4, 5]);
      const diff = subPoly(a, b, N);
      expect(diff.coeffs).toEqual([1, 2, 3]);
    });

    it("multiplies polynomials", () => {
      const a = polynomial([1, 1]);
      const b = polynomial([1, 1]);
      const prod = mulPoly(a, b, N);
      expect(prod.coeffs).toEqual([1, 2, 1]);
    });

    it("multiplies by zero", () => {
      const p = polynomial([1, 2, 3]);
      expect(mulPoly(p, zeroPoly(), N).coeffs).toEqual([]);
    });

    it("negates polynomial", () => {
      const p = polynomial([1, -2, 3]);
      const neg = negatePoly(p, N);
      expect(neg.coeffs).toEqual([-1, 2, -3]);
    });

    it("scales polynomial", () => {
      const p = polynomial([1, 2, 3]);
      const scaled = scalePoly(p, 2, N);
      expect(scaled.coeffs).toEqual([2, 4, 6]);
    });
  });

  describe("calculus", () => {
    it("derivative", () => {
      const p = polynomial([1, 2, 3]);
      const dp = derivative(p, N);
      expect(dp.coeffs).toEqual([2, 6]);
    });

    it("derivative of constant is zero", () => {
      const p = constant(5);
      expect(isZeroPoly(derivative(p, N))).toBe(true);
    });

    it("derivative of zero is zero", () => {
      expect(isZeroPoly(derivative(zeroPoly(), N))).toBe(true);
    });

    it("integral", () => {
      const p = polynomial([2, 6]);
      const ip = polyIntegral(p, N, F);
      expect(ip.coeffs).toEqual([0, 2, 3]);
    });

    it("nthDerivative", () => {
      const p = polynomial([1, 2, 3, 4]);
      expect(nthDerivative(p, 0, N).coeffs).toEqual([1, 2, 3, 4]);
      expect(nthDerivative(p, 1, N).coeffs).toEqual([2, 6, 12]);
      expect(nthDerivative(p, 2, N).coeffs).toEqual([6, 24]);
      expect(nthDerivative(p, 3, N).coeffs).toEqual([24]);
      expect(isZeroPoly(nthDerivative(p, 4, N))).toBe(true);
    });
  });

  describe("division", () => {
    it("divides polynomials", () => {
      const a = polynomial([-1, 0, 1]);
      const b = polynomial([-1, 1]);
      const [q, r] = divPoly(a, b, N, F);
      expect(q.coeffs).toEqual([1, 1]);
      expect(isZeroPoly(r)).toBe(true);
    });

    it("division with remainder", () => {
      const a = polynomial([1, 0, 1]);
      const b = polynomial([-1, 1]);
      const [q, r] = divPoly(a, b, N, F);
      expect(q.coeffs).toEqual([1, 1]);
      expect(r.coeffs).toEqual([2]);
    });

    it("throws for division by zero", () => {
      const p = polynomial([1, 2, 3]);
      expect(() => divPoly(p, zeroPoly(), N, F)).toThrow(RangeError);
    });

    it("dividend smaller than divisor returns zero quotient", () => {
      const a = polynomial([1, 2]);
      const b = polynomial([1, 0, 1]);
      const [q, r] = divPoly(a, b, N, F);
      expect(isZeroPoly(q)).toBe(true);
      expect(r.coeffs).toEqual([1, 2]);
    });
  });

  describe("gcd", () => {
    it("computes GCD of polynomials", () => {
      const a = polynomial([-1, 0, 1]);
      const b = polynomial([-1, 1]);
      const g = gcdPoly(a, b, N, F);
      expect(degree(g)).toBe(1);
      const [, r1] = divPoly(a, g, N, F);
      const [, r2] = divPoly(b, g, N, F);
      expect(isZeroPoly(r1)).toBe(true);
      expect(isZeroPoly(r2)).toBe(true);
    });

    it("GCD with zero", () => {
      const p = polynomial([1, 2, 1]);
      const g = gcdPoly(p, zeroPoly(), N, F);
      expect(degree(g)).toBe(2);
    });
  });

  describe("rationalRoots", () => {
    it("finds rational roots", () => {
      const p = polynomial([2, -3, 1]);
      const roots = rationalRoots(p);
      expect(roots).toEqual([1, 2]);
    });

    it("finds zero as a root", () => {
      const p = polynomial([0, -1, 1]);
      const roots = rationalRoots(p);
      expect(roots).toContain(0);
      expect(roots).toContain(1);
    });

    it("returns empty for polynomials with no rational roots", () => {
      const p = polynomial([1, 0, 1]);
      const roots = rationalRoots(p);
      expect(roots).toEqual([]);
    });
  });

  describe("numericPolynomial", () => {
    const PN = numericPolynomial(N);

    it("zero", () => {
      expect(isZeroPoly(PN.zero())).toBe(true);
    });

    it("one", () => {
      expect(PN.one().coeffs).toEqual([1]);
    });

    it("add", () => {
      const a = polynomial([1, 2]);
      const b = polynomial([3, 4]);
      expect(PN.add(a, b).coeffs).toEqual([4, 6]);
    });

    it("mul", () => {
      const a = polynomial([1, 1]);
      const b = polynomial([1, -1]);
      const prod = PN.mul(a, b);
      expect(prod.coeffs).toEqual([1, 0, -1]);
    });
  });

  describe("utilities", () => {
    it("equals", () => {
      const a = polynomial([1, 2, 3]);
      const b = polynomial([1, 2, 3]);
      const c = polynomial([1, 2, 4]);
      expect(polyEquals(a, b, N)).toBe(true);
      expect(polyEquals(a, c, N)).toBe(false);
    });

    it("toString", () => {
      const p = polynomial([1, 2, 3]);
      const s = polyToString(p, N);
      expect(s).toContain("3");
      expect(s).toContain("x");
    });

    it("compose", () => {
      const p = polynomial([0, 0, 1]);
      const q = polynomial([1, 1]);
      const composed = composePoly(p, q, N);
      expect(composed.coeffs).toEqual([1, 2, 1]);
    });
  });
});
