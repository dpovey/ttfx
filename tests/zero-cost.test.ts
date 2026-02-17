/**
 * Tests for zero-cost abstractions
 *
 * These test the runtime behavior of the type-level APIs.
 * The macro transformations are tested separately — these verify that
 * the runtime fallback implementations are correct, and that the types
 * work as expected.
 */

import { describe, it, expect } from "vitest";
import {
  Option,
  Result,
  wrap,
  unwrap,
  newtypeCtor,
  validatedNewtype,
  pipe,
  flow,
  invariant,
  unreachable,
  debugOnly,
  match,
  matchLiteral,
  matchGuard,
  type Newtype,
  type Ok,
  type Err,
  type Equals,
  type Extends,
} from "../src/use-cases/zero-cost/index.js";

// ============================================================================
// Option Tests
// ============================================================================

describe("Option", () => {
  describe("constructors", () => {
    it("should create Some from a non-null value", () => {
      const opt = Option.from(42);
      expect(opt).toBe(42);
      expect(Option.isSome(opt)).toBe(true);
      expect(Option.isNone(opt)).toBe(false);
    });

    it("should create None from null", () => {
      const opt = Option.from(null);
      expect(opt).toBeNull();
      expect(Option.isSome(opt)).toBe(false);
      expect(Option.isNone(opt)).toBe(true);
    });

    it("should coerce undefined to null", () => {
      const opt = Option.from(undefined);
      expect(opt).toBeNull();
    });

    it("should wrap a value with some()", () => {
      const opt = Option.some("hello");
      expect(opt).toBe("hello");
    });

    it("should have a none constant", () => {
      expect(Option.none).toBeNull();
    });
  });

  describe("type guards", () => {
    it("should narrow types with isSome", () => {
      const opt: Option<string> = Option.from("hello");
      if (Option.isSome(opt)) {
        // In this branch, opt is string (not null)
        expect(opt.toUpperCase()).toBe("HELLO");
      }
    });

    it("should narrow types with isNone", () => {
      const opt: Option<string> = Option.from(null);
      if (Option.isNone(opt)) {
        expect(opt).toBeNull();
      }
    });
  });

  describe("zero-cost representation", () => {
    it("should be the raw value (no wrapper object)", () => {
      const opt = Option.from(42);
      // The key insight: Option<number> IS just number | null
      expect(typeof opt).toBe("number");
      expect(opt).toBe(42);
    });

    it("should work with strings", () => {
      const opt = Option.from("hello");
      expect(typeof opt).toBe("string");
    });

    it("should work with objects", () => {
      const obj = { name: "Alice" };
      const opt = Option.from(obj);
      expect(opt).toBe(obj); // Same reference, no wrapping
    });
  });
});

// ============================================================================
// Result Tests
// ============================================================================

describe("Result", () => {
  describe("constructors", () => {
    it("should create Ok", () => {
      const r = Result.ok(42);
      expect(r).toEqual({ ok: true, value: 42 });
      expect(Result.isOk(r)).toBe(true);
      expect(Result.isErr(r)).toBe(false);
    });

    it("should create Err", () => {
      const r = Result.err("something went wrong");
      expect(r).toEqual({ ok: false, error: "something went wrong" });
      expect(Result.isOk(r)).toBe(false);
      expect(Result.isErr(r)).toBe(true);
    });
  });

  describe("try", () => {
    it("should wrap successful computation in Ok", () => {
      const r = Result.try(() => JSON.parse('{"a": 1}'));
      expect(Result.isOk(r)).toBe(true);
      if (Result.isOk(r)) {
        expect(r.value).toEqual({ a: 1 });
      }
    });

    it("should wrap thrown error in Err", () => {
      const r = Result.try(() => JSON.parse("invalid json!!!"));
      expect(Result.isErr(r)).toBe(true);
      if (Result.isErr(r)) {
        expect(r.error).toBeInstanceOf(Error);
      }
    });

    it("should wrap non-Error throws in Error", () => {
      const r = Result.try(() => {
        throw "string error";
      });
      expect(Result.isErr(r)).toBe(true);
      if (Result.isErr(r)) {
        expect(r.error).toBeInstanceOf(Error);
        expect(r.error.message).toBe("string error");
      }
    });
  });

  describe("fromPromise", () => {
    it("should wrap resolved promise in Ok", async () => {
      const r = await Result.fromPromise(Promise.resolve(42));
      expect(r).toEqual({ ok: true, value: 42 });
    });

    it("should wrap rejected promise in Err", async () => {
      const r = await Result.fromPromise(
        Promise.reject(new Error("async fail")),
      );
      expect(Result.isErr(r)).toBe(true);
      if (Result.isErr(r)) {
        expect(r.error.message).toBe("async fail");
      }
    });
  });

  describe("all", () => {
    it("should collect Ok results into Ok array", () => {
      const results = [Result.ok(1), Result.ok(2), Result.ok(3)];
      const collected = Result.all(results);
      expect(collected).toEqual({ ok: true, value: [1, 2, 3] });
    });

    it("should short-circuit on first Err", () => {
      const results = [Result.ok(1), Result.err("fail"), Result.ok(3)];
      const collected = Result.all(results);
      expect(collected).toEqual({ ok: false, error: "fail" });
    });

    it("should handle empty array", () => {
      const collected = Result.all([]);
      expect(collected).toEqual({ ok: true, value: [] });
    });
  });

  describe("type narrowing", () => {
    it("should narrow Ok type", () => {
      const r: Result<number, string> = Result.ok(42);
      if (Result.isOk(r)) {
        const val: number = r.value;
        expect(val).toBe(42);
      }
    });

    it("should narrow Err type", () => {
      const r: Result<number, string> = Result.err("oops");
      if (Result.isErr(r)) {
        const err: string = r.error;
        expect(err).toBe("oops");
      }
    });
  });
});

// ============================================================================
// Newtype Tests
// ============================================================================

describe("Newtype", () => {
  type UserId = Newtype<number, "UserId">;
  type Email = Newtype<string, "Email">;

  describe("wrap/unwrap", () => {
    it("should wrap a value", () => {
      const id = wrap<UserId>(42);
      expect(id).toBe(42); // Zero cost — same value
    });

    it("should unwrap a value", () => {
      const id = wrap<UserId>(42);
      const raw = unwrap(id);
      expect(raw).toBe(42);
    });

    it("should work with strings", () => {
      const email = wrap<Email>("user@example.com");
      expect(email).toBe("user@example.com");
      expect(unwrap(email)).toBe("user@example.com");
    });

    it("should be truly zero-cost (same reference)", () => {
      const original = 42;
      const wrapped = wrap<UserId>(original);
      const unwrapped = unwrap(wrapped);
      // All three are the exact same value
      expect(wrapped).toBe(original);
      expect(unwrapped).toBe(original);
    });
  });

  describe("newtypeCtor", () => {
    it("should create a constructor function", () => {
      const mkUserId = newtypeCtor<UserId>();
      const id = mkUserId(42);
      expect(id).toBe(42);
    });

    it("should be reusable", () => {
      const mkEmail = newtypeCtor<Email>();
      const e1 = mkEmail("a@b.com");
      const e2 = mkEmail("c@d.com");
      expect(e1).toBe("a@b.com");
      expect(e2).toBe("c@d.com");
    });
  });

  describe("validatedNewtype", () => {
    it("should pass validation", () => {
      const mkEmail = validatedNewtype<Email>((s: string) => s.includes("@"));
      const email = mkEmail("user@example.com");
      expect(email).toBe("user@example.com");
    });

    it("should throw on invalid value", () => {
      const mkEmail = validatedNewtype<Email>(
        (s: string) => s.includes("@"),
        "Invalid email",
      );
      expect(() => mkEmail("not-an-email")).toThrow("Invalid email");
    });

    it("should use default error message", () => {
      const mkPositive = validatedNewtype<Newtype<number, "Positive">>(
        (n: number) => n > 0,
      );
      expect(() => mkPositive(-1)).toThrow("Invalid value for newtype: -1");
    });
  });
});

// ============================================================================
// Pipe/Flow Tests
// ============================================================================

describe("pipe", () => {
  it("should return value with no functions", () => {
    expect(pipe(42)).toBe(42);
  });

  it("should apply one function", () => {
    const result = pipe("hello", (s: string) => s.toUpperCase());
    expect(result).toBe("HELLO");
  });

  it("should chain multiple functions", () => {
    const result = pipe(
      "  hello world  ",
      (s: string) => s.trim(),
      (s: string) => s.split(" "),
      (xs: string[]) => xs.length,
    );
    expect(result).toBe(2);
  });

  it("should handle type transformations", () => {
    const result = pipe(
      [1, 2, 3, 4, 5],
      (xs: number[]) => xs.filter((x) => x > 2),
      (xs: number[]) => xs.map((x) => x * 2),
      (xs: number[]) => xs.reduce((a, b) => a + b, 0),
    );
    expect(result).toBe(24); // (3+4+5) * 2 = 24
  });

  it("should work with named functions", () => {
    const double = (x: number) => x * 2;
    const addOne = (x: number) => x + 1;
    const toString = (x: number) => String(x);

    const result = pipe(5, double, addOne, toString);
    expect(result).toBe("11");
  });
});

describe("flow", () => {
  it("should compose a single function", () => {
    const f = flow((x: number) => x * 2);
    expect(f(5)).toBe(10);
  });

  it("should compose multiple functions", () => {
    const process = flow(
      (s: string) => s.trim(),
      (s: string) => s.toLowerCase(),
      (s: string) => s.replace(/\s+/g, "-"),
    );
    expect(process("  Hello World  ")).toBe("hello-world");
  });

  it("should be reusable", () => {
    const double = (x: number) => x * 2;
    const addOne = (x: number) => x + 1;
    const pipeline = flow(double, addOne);

    expect(pipeline(5)).toBe(11);
    expect(pipeline(10)).toBe(21);
    expect(pipeline(0)).toBe(1);
  });

  it("should compose with type changes", () => {
    const pipeline = flow(
      (n: number) => n.toString(),
      (s: string) => s.length,
      (n: number) => n > 2,
    );

    expect(pipeline(99)).toBe(false); // "99".length = 2, 2 > 2 = false
    expect(pipeline(100)).toBe(true); // "100".length = 3, 3 > 2 = true
  });
});

// ============================================================================
// Assertion Tests
// ============================================================================

describe("invariant", () => {
  it("should pass when condition is true", () => {
    expect(() => invariant(true, "should not throw")).not.toThrow();
  });

  it("should throw when condition is false", () => {
    expect(() => invariant(false, "expected failure")).toThrow(
      "expected failure",
    );
  });

  it("should use default message", () => {
    expect(() => invariant(false)).toThrow("Invariant violation");
  });

  it("should narrow types", () => {
    const value: string | null = "hello";
    invariant(value !== null, "value should not be null");
    // After invariant, value is narrowed to string
    expect(value.toUpperCase()).toBe("HELLO");
  });
});

describe("unreachable", () => {
  it("should throw when called", () => {
    expect(() => unreachable()).toThrow("Unreachable code reached");
  });

  it("should work in exhaustive switch", () => {
    type Direction = "north" | "south" | "east" | "west";

    function directionToAngle(dir: Direction): number {
      switch (dir) {
        case "north":
          return 0;
        case "east":
          return 90;
        case "south":
          return 180;
        case "west":
          return 270;
        default:
          return unreachable(dir);
      }
    }

    expect(directionToAngle("north")).toBe(0);
    expect(directionToAngle("east")).toBe(90);
  });
});

describe("debugOnly", () => {
  it("should execute the function", () => {
    let called = false;
    debugOnly(() => {
      called = true;
    });
    expect(called).toBe(true);
  });
});

// ============================================================================
// Pattern Matching Tests
// ============================================================================

describe("match", () => {
  type Shape =
    | { kind: "circle"; radius: number }
    | { kind: "rect"; width: number; height: number }
    | { kind: "triangle"; base: number; height: number };

  it("should match on discriminated unions", () => {
    const shape: Shape = { kind: "circle", radius: 5 };
    const area = match(shape, {
      circle: (s) => Math.PI * s.radius ** 2,
      rect: (s) => s.width * s.height,
      triangle: (s) => 0.5 * s.base * s.height,
    });
    expect(area).toBeCloseTo(Math.PI * 25);
  });

  it("should match rect", () => {
    const shape: Shape = { kind: "rect", width: 4, height: 5 };
    const area = match(shape, {
      circle: (s) => Math.PI * s.radius ** 2,
      rect: (s) => s.width * s.height,
      triangle: (s) => 0.5 * s.base * s.height,
    });
    expect(area).toBe(20);
  });

  it("should match triangle", () => {
    const shape: Shape = { kind: "triangle", base: 6, height: 4 };
    const area = match(shape, {
      circle: (s) => Math.PI * s.radius ** 2,
      rect: (s) => s.width * s.height,
      triangle: (s) => 0.5 * s.base * s.height,
    });
    expect(area).toBe(12);
  });

  it("should throw on unmatched discriminant", () => {
    const shape = { kind: "hexagon" } as unknown as Shape;
    expect(() =>
      match(shape, {
        circle: () => 0,
        rect: () => 0,
        triangle: () => 0,
      }),
    ).toThrow("No handler for discriminant: hexagon");
  });

  it("should support custom discriminant key", () => {
    type Event =
      | { type: "click"; x: number; y: number }
      | { type: "keypress"; key: string };

    const event: Event = { type: "click", x: 10, y: 20 };
    const desc = match(
      event,
      {
        click: (e) => `Clicked at ${e.x},${e.y}`,
        keypress: (e) => `Pressed ${e.key}`,
      } as Record<string, (e: any) => string>,
      "type" as keyof Event,
    );
    expect(desc).toBe("Clicked at 10,20");
  });
});

describe("matchLiteral", () => {
  it("should match string literals", () => {
    const result = matchLiteral("b" as "a" | "b" | "c", {
      a: () => 1,
      b: () => 2,
      c: () => 3,
    });
    expect(result).toBe(2);
  });

  it("should match number literals", () => {
    const result = matchLiteral(404 as 200 | 404 | 500, {
      200: () => "OK",
      404: () => "Not Found",
      500: () => "Server Error",
    });
    expect(result).toBe("Not Found");
  });

  it("should use wildcard for unmatched values", () => {
    const result = matchLiteral(
      999 as number,
      {
        200: () => "OK",
        _: () => "Unknown",
      } as LiteralHandlers<number, string>,
    );
    expect(result).toBe("Unknown");
  });

  it("should throw without wildcard on unmatched value", () => {
    expect(() =>
      matchLiteral(
        999 as number,
        {
          200: () => "OK",
        } as LiteralHandlers<number, string>,
      ),
    ).toThrow("No handler for value: 999");
  });
});

describe("matchGuard", () => {
  it("should match first true guard", () => {
    const score = 85;
    const grade = matchGuard(score, [
      [(s) => s >= 90, () => "A"],
      [(s) => s >= 80, () => "B"],
      [(s) => s >= 70, () => "C"],
      [() => true, () => "F"],
    ]);
    expect(grade).toBe("B");
  });

  it("should match the default guard", () => {
    const score = 50;
    const grade = matchGuard(score, [
      [(s) => s >= 90, () => "A"],
      [(s) => s >= 80, () => "B"],
      [(s) => s >= 70, () => "C"],
      [() => true, () => "F"],
    ]);
    expect(grade).toBe("F");
  });

  it("should throw when no guard matches", () => {
    expect(() => matchGuard(42, [[(x) => x > 100, () => "big"]])).toThrow(
      "No matching guard",
    );
  });

  it("should work with complex predicates", () => {
    type User = { name: string; age: number; admin: boolean };
    const user: User = { name: "Alice", age: 30, admin: true };

    const access = matchGuard(user, [
      [(u) => u.admin, () => "full"],
      [(u) => u.age >= 18, () => "standard"],
      [() => true, () => "restricted"],
    ]);
    expect(access).toBe("full");
  });
});

// ============================================================================
// Type-Level Tests (compile-time only — if these compile, they pass)
// ============================================================================

describe("type-level checks", () => {
  it("should have correct Option type", () => {
    // Option<T> is just T | null
    type _Check1 = Equals<Option<number>, number | null>;
    const _: _Check1 = true as Equals<number | null, number | null>;
  });

  it("should have correct Result types", () => {
    type _OkCheck = Ok<number>;
    type _ErrCheck = Err<string>;
    const ok: _OkCheck = { ok: true, value: 42 };
    const err: _ErrCheck = { ok: false, error: "fail" };
    expect(ok.ok).toBe(true);
    expect(err.ok).toBe(false);
  });

  it("should have correct Newtype branding", () => {
    type UserId = Newtype<number, "UserId">;
    type OrderId = Newtype<number, "OrderId">;

    // These are different types even though both wrap number
    // TypeScript will prevent assigning one to the other
    const userId = wrap<UserId>(1);
    const orderId = wrap<OrderId>(2);

    // Both are numbers at runtime
    expect(typeof userId).toBe("number");
    expect(typeof orderId).toBe("number");
  });

  it("should support Equals type", () => {
    type _T1 = Equals<string, string>; // true
    type _T2 = Equals<string, number>; // false
    type _T3 = Extends<"hello", string>; // true

    // These are compile-time checks
    const _a: _T1 = true;
    const _b: _T2 = false;
    const _c: _T3 = true;
  });
});

// ============================================================================
// Composition Tests — Using multiple abstractions together
// ============================================================================

describe("composition", () => {
  it("should compose pipe with Result", () => {
    const parseAndDouble = pipe(
      '{"value": 21}',
      (s: string) => Result.try(() => JSON.parse(s)),
      (r) => (Result.isOk(r) ? Result.ok(r.value.value * 2) : r),
    );
    expect(parseAndDouble).toEqual({ ok: true, value: 42 });
  });

  it("should compose pipe with Option", () => {
    const users = [
      { name: "Alice", email: "alice@example.com" },
      { name: "Bob", email: null },
    ];

    const getEmail = (name: string) => {
      const user = users.find((u) => u.name === name);
      return Option.from(user?.email);
    };

    expect(getEmail("Alice")).toBe("alice@example.com");
    expect(getEmail("Bob")).toBeNull();
    expect(getEmail("Charlie")).toBeNull();
  });

  it("should compose flow with newtypes", () => {
    type Celsius = Newtype<number, "Celsius">;
    type Fahrenheit = Newtype<number, "Fahrenheit">;

    const toFahrenheit = flow(
      (c: number) => (c * 9) / 5 + 32,
      (f: number) => wrap<Fahrenheit>(f),
    );

    const temp = toFahrenheit(100);
    expect(unwrap(temp)).toBe(212);
  });

  it("should compose match with Result", () => {
    type ApiResponse =
      | { kind: "success"; data: string }
      | { kind: "error"; message: string }
      | { kind: "loading" };

    const response: ApiResponse = { kind: "success", data: "hello" };

    const result = match(response, {
      success: (r) => Result.ok(r.data),
      error: (r) => Result.err(r.message),
      loading: () => Result.err("Still loading"),
    });

    expect(result).toEqual({ ok: true, value: "hello" });
  });
});

// Need to import the type for the matchLiteral test
type LiteralHandlers<T extends string | number, R> = {
  [K in T]?: () => R;
} & {
  _?: () => R;
};
