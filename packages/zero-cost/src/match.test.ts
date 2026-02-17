/**
 * Tests for zero-cost pattern matching macros.
 */

import { describe, it, expect } from "vitest";
import {
  match,
  matchLiteral,
  matchGuard,
  matchMacro,
  matchLiteralMacro,
  matchGuardMacro,
  matchReflectMacro,
} from "./match.js";

// ============================================================================
// Runtime Function Tests (pre-macro expansion)
// ============================================================================

describe("match() runtime function", () => {
  type Shape =
    | { kind: "circle"; radius: number }
    | { kind: "rect"; width: number; height: number };

  it("should match circle", () => {
    const shape: Shape = { kind: "circle", radius: 5 };
    const result = match(
      shape,
      {
        circle: (s) => Math.PI * s.radius ** 2,
        rect: (s) => s.width * s.height,
      },
      "kind",
    );
    expect(result).toBeCloseTo(Math.PI * 25);
  });

  it("should match rect", () => {
    const shape: Shape = { kind: "rect", width: 4, height: 5 };
    const result = match(
      shape,
      {
        circle: (s) => Math.PI * s.radius ** 2,
        rect: (s) => s.width * s.height,
      },
      "kind",
    );
    expect(result).toBe(20);
  });

  it("should default to 'kind' discriminant", () => {
    const shape: Shape = { kind: "circle", radius: 3 };
    const result = match(shape, {
      circle: () => "circle",
      rect: () => "rect",
    });
    expect(result).toBe("circle");
  });

  it("should throw on missing handler", () => {
    const shape: Shape = { kind: "circle", radius: 5 };
    expect(() =>
      match(shape, {
        rect: () => 0,
      } as any),
    ).toThrow("No handler for discriminant: circle");
  });
});

describe("matchLiteral() runtime function", () => {
  it("should match string literals", () => {
    const value = "hello";
    const result = matchLiteral(value, {
      hello: () => "greeting",
      goodbye: () => "farewell",
    });
    expect(result).toBe("greeting");
  });

  it("should match number literals", () => {
    const code = 200;
    const result = matchLiteral(code, {
      200: () => "OK",
      404: () => "Not Found",
      500: () => "Server Error",
    });
    expect(result).toBe("OK");
  });

  it("should use wildcard handler", () => {
    const code = 418;
    const result = matchLiteral(code, {
      200: () => "OK",
      _: () => "Unknown",
    });
    expect(result).toBe("Unknown");
  });

  it("should throw without wildcard on non-match", () => {
    expect(() =>
      matchLiteral(999, {
        200: () => "OK",
      }),
    ).toThrow("No handler for value: 999");
  });
});

describe("matchGuard() runtime function", () => {
  it("should match with predicate guards", () => {
    const score = 85;
    const result = matchGuard(score, [
      [(s) => s >= 90, () => "A"],
      [(s) => s >= 80, () => "B"],
      [(s) => s >= 70, () => "C"],
      [() => true, () => "F"],
    ]);
    expect(result).toBe("B");
  });

  it("should match first passing guard", () => {
    const value = 5;
    const result = matchGuard(value, [
      [(v) => v > 0, () => "positive"],
      [(v) => v < 10, () => "small"],
    ]);
    expect(result).toBe("positive");
  });

  it("should throw when no guard matches", () => {
    expect(() =>
      matchGuard(100, [
        [(v) => v < 0, () => "negative"],
        [(v) => v === 0, () => "zero"],
      ]),
    ).toThrow("No matching guard");
  });
});

// ============================================================================
// Macro Definition Tests
// ============================================================================

describe("match macro definitions", () => {
  it("should export matchMacro", () => {
    expect(matchMacro).toBeDefined();
    expect(matchMacro.name).toBe("match");
    expect(matchMacro.expand).toBeDefined();
  });

  it("should export matchLiteralMacro", () => {
    expect(matchLiteralMacro).toBeDefined();
    expect(matchLiteralMacro.name).toBe("matchLiteral");
    expect(matchLiteralMacro.expand).toBeDefined();
  });

  it("should export matchGuardMacro", () => {
    expect(matchGuardMacro).toBeDefined();
    expect(matchGuardMacro.name).toBe("matchGuard");
    expect(matchGuardMacro.expand).toBeDefined();
  });

  it("should export matchReflectMacro", () => {
    expect(matchReflectMacro).toBeDefined();
    expect(matchReflectMacro.name).toBe("matchReflect");
    expect(matchReflectMacro.expand).toBeDefined();
  });
});

describe("matchReflect macro design", () => {
  /**
   * The matchReflect macro uses compile-time type reflection to:
   *
   * 1. Auto-detect discriminant fields:
   *    - Checks for common field names: kind, _tag, type, tag, __typename
   *    - Verifies all union members have the field with literal types
   *
   * 2. Support instanceof discrimination:
   *    - When all union members are classes, uses instanceof checks
   *    - Enables pattern matching on class hierarchies
   *
   * 3. Fall back to structural discrimination:
   *    - When no common discriminant exists, uses unique property presence
   *    - "uniqueProp" in value checks
   *
   * Usage patterns:
   *
   * ```typescript
   * // Auto-detects "kind" field
   * type Shape = { kind: "circle" } | { kind: "rect" };
   * matchReflect(shape, { circle: ..., rect: ... });
   * // Compiles to: shape.kind === "circle" ? ... : ...
   *
   * // Auto-detects "_tag" field (Effect-style)
   * type Result = { _tag: "Ok"; value: T } | { _tag: "Err"; error: E };
   * matchReflect(result, { Ok: ..., Err: ... });
   * // Compiles to: result._tag === "Ok" ? ... : ...
   *
   * // Class unions use instanceof
   * class Dog { bark() {} }
   * class Cat { meow() {} }
   * matchReflect(pet, { Dog: ..., Cat: ... });
   * // Compiles to: pet instanceof Dog ? ... : ...
   *
   * // Structural discrimination uses "in" checks
   * type A = { foo: number };
   * type B = { bar: string };
   * matchReflect(value, { A: ..., B: ... });
   * // Compiles to: "foo" in value ? ... : ...
   * ```
   */
  it("documents the matchReflect design", () => {
    expect(true).toBe(true);
  });
});
