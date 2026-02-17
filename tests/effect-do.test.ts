/**
 * Tests for do/for comprehension macros
 */

import { describe, it, expect } from "vitest";
import {
  Option,
  some,
  none,
  Either,
  left,
  right,
  IO,
  io,
  For,
} from "../src/use-cases/effect-do/index.js";

describe("Option monad", () => {
  describe("some", () => {
    it("should create a Some value", () => {
      const opt = some(42);
      expect(opt.value).toBe(42);
    });

    it("should map over Some", () => {
      const opt = some(21);
      const result = opt.map((x) => x * 2);
      expect(result.value).toBe(42);
    });

    it("should flatMap over Some", () => {
      const opt = some(21);
      const result = opt.flatMap((x) => some(x * 2));
      expect(result.value).toBe(42);
    });
  });

  describe("none", () => {
    it("should create a None value", () => {
      const opt = none<number>();
      expect(opt.value).toBeUndefined();
    });

    it("should return none when mapping over None", () => {
      const opt = none<number>();
      const result = opt.map((x) => x * 2);
      expect(result.value).toBeUndefined();
    });

    it("should return none when flatMapping over None", () => {
      const opt = none<number>();
      const result = opt.flatMap((x) => some(x * 2));
      expect(result.value).toBeUndefined();
    });
  });

  describe("chaining", () => {
    it("should chain multiple operations", () => {
      const result = some(10)
        .flatMap((x) => some(x + 5))
        .flatMap((x) => some(x * 2))
        .map((x) => x.toString());

      expect(result.value).toBe("30");
    });

    it("should short-circuit on none", () => {
      let called = false;
      const result = some(10)
        .flatMap(() => none<number>())
        .map((x) => {
          called = true;
          return x * 2;
        });

      expect(result.value).toBeUndefined();
      expect(called).toBe(false);
    });
  });
});

describe("Either monad", () => {
  describe("right (success)", () => {
    it("should create a Right value", () => {
      const either = right<string, number>(42);
      expect(either.value).toBe(42);
      expect(either.isRight).toBe(true);
    });

    it("should map over Right", () => {
      const either = right<string, number>(21);
      const result = either.map((x) => x * 2);
      expect(result.value).toBe(42);
    });

    it("should flatMap over Right", () => {
      const either = right<string, number>(21);
      const result = either.flatMap((x) => right<string, number>(x * 2));
      expect(result.value).toBe(42);
    });
  });

  describe("left (error)", () => {
    it("should create a Left value", () => {
      const either = left<string, number>("error");
      expect(either.error).toBe("error");
      expect(either.isRight).toBe(false);
    });

    it("should not map over Left", () => {
      const either = left<string, number>("error");
      const result = either.map((x) => x * 2);
      expect(result.error).toBe("error");
      expect(result.isRight).toBe(false);
    });

    it("should not flatMap over Left", () => {
      const either = left<string, number>("error");
      const result = either.flatMap((x) => right<string, number>(x * 2));
      expect(result.error).toBe("error");
    });
  });

  describe("error handling", () => {
    it("should preserve error through chain", () => {
      const result = right<string, number>(10)
        .flatMap(() => left<string, number>("failed"))
        .map((x) => x * 2)
        .flatMap((x) => right<string, number>(x + 1));

      expect(result.isRight).toBe(false);
      expect(result.error).toBe("failed");
    });
  });
});

describe("IO monad", () => {
  describe("pure values", () => {
    it("should create an IO from a value", () => {
      const ioValue = io(() => 42);
      expect(ioValue.run()).toBe(42);
    });

    it("should map over IO", () => {
      const ioValue = io(() => 21);
      const result = ioValue.map((x) => x * 2);
      expect(result.run()).toBe(42);
    });

    it("should flatMap over IO", () => {
      const ioValue = io(() => 21);
      const result = ioValue.flatMap((x) => io(() => x * 2));
      expect(result.run()).toBe(42);
    });
  });

  describe("lazy evaluation", () => {
    it("should not execute until run() is called", () => {
      let executed = false;
      const ioValue = io(() => {
        executed = true;
        return 42;
      });

      expect(executed).toBe(false);
      ioValue.run();
      expect(executed).toBe(true);
    });

    it("should execute fresh each time run() is called", () => {
      let count = 0;
      const ioValue = io(() => {
        count++;
        return count;
      });

      expect(ioValue.run()).toBe(1);
      expect(ioValue.run()).toBe(2);
      expect(ioValue.run()).toBe(3);
    });
  });

  describe("composition", () => {
    it("should compose multiple IO operations", () => {
      const readConfig = io(() => ({ port: 3000 }));
      const parsePort = (config: { port: number }) =>
        io(() => config.port.toString());
      const formatUrl = (port: string) => io(() => `http://localhost:${port}`);

      const url = readConfig.flatMap(parsePort).flatMap(formatUrl);

      expect(url.run()).toBe("http://localhost:3000");
    });
  });
});

describe("Do comprehension semantics", () => {
  describe("generator-based syntax", () => {
    // Testing what the Do macro transforms into

    it("should flatten nested flatMaps", () => {
      // Do(function* () {
      //   const a = yield* some(10);
      //   const b = yield* some(20);
      //   return { a, b };
      // })
      // transforms to:
      const result = some(10).flatMap((a) => some(20).map((b) => ({ a, b })));

      expect(result.value).toEqual({ a: 10, b: 20 });
    });

    it("should handle multiple bindings", () => {
      const result = some(1).flatMap((a) =>
        some(2).flatMap((b) => some(3).map((c) => ({ a, b, c }))),
      );

      expect(result.value).toEqual({ a: 1, b: 2, c: 3 });
    });

    it("should short-circuit correctly", () => {
      const result = some(1).flatMap((a) =>
        none<number>().flatMap((b: number) =>
          some(3).map((c) => ({ a, b, c })),
        ),
      );

      expect(result.value).toBeUndefined();
    });
  });
});

describe("forYield comprehension semantics", () => {
  describe("explicit binding syntax", () => {
    // Testing what forYield transforms into

    it("should work with single binding", () => {
      // forYield([["x", some(42)]], x)
      // transforms to:
      const result = some(42).map((x) => x);

      expect(result.value).toBe(42);
    });

    it("should work with multiple bindings", () => {
      // forYield([["a", some(1)], ["b", some(2)]], a + b)
      // transforms to:
      const result = some(1).flatMap((a) => some(2).map((b) => a + b));

      expect(result.value).toBe(3);
    });
  });
});

describe("asyncDo comprehension semantics", () => {
  describe("Promise chaining", () => {
    it("should transform to Promise.then chains", async () => {
      // asyncDo(function* () {
      //   const a = yield* Promise.resolve(10);
      //   const b = yield* Promise.resolve(20);
      //   return a + b;
      // })
      // transforms to:
      const result = await Promise.resolve(10).then((a) =>
        Promise.resolve(20).then((b) => a + b),
      );

      expect(result).toBe(30);
    });

    it("should handle async operations", async () => {
      const delay = (ms: number, value: number) =>
        new Promise<number>((resolve) => setTimeout(() => resolve(value), ms));

      const result = await delay(1, 10).then((a) =>
        delay(1, 20).then((b) => a + b),
      );

      expect(result).toBe(30);
    });

    it("should propagate errors", async () => {
      const result = Promise.resolve(10).then(() =>
        Promise.reject(new Error("failed")).then(() => 30),
      );

      await expect(result).rejects.toThrow("failed");
    });
  });
});

describe("Monad laws", () => {
  // Verify our implementations follow monad laws

  describe("Option monad laws", () => {
    it("left identity: return a >>= f ≡ f a", () => {
      const f = (x: number) => some(x * 2);
      const a = 21;

      const lhs = some(a).flatMap(f);
      const rhs = f(a);

      expect(lhs.value).toBe(rhs.value);
    });

    it("right identity: m >>= return ≡ m", () => {
      const m = some(42);

      const lhs = m.flatMap((x) => some(x));
      const rhs = m;

      expect(lhs.value).toBe(rhs.value);
    });

    it("associativity: (m >>= f) >>= g ≡ m >>= (x => f x >>= g)", () => {
      const m = some(10);
      const f = (x: number) => some(x + 5);
      const g = (x: number) => some(x * 2);

      const lhs = m.flatMap(f).flatMap(g);
      const rhs = m.flatMap((x) => f(x).flatMap(g));

      expect(lhs.value).toBe(rhs.value);
    });
  });

  describe("Either monad laws", () => {
    it("left identity: return a >>= f ≡ f a", () => {
      const f = (x: number) => right<string, number>(x * 2);
      const a = 21;

      const lhs = right<string, number>(a).flatMap(f);
      const rhs = f(a);

      expect(lhs.value).toBe(rhs.value);
    });

    it("right identity: m >>= return ≡ m", () => {
      const m = right<string, number>(42);

      const lhs = m.flatMap((x) => right<string, number>(x));
      const rhs = m;

      expect(lhs.value).toBe(rhs.value);
    });

    it("associativity", () => {
      const m = right<string, number>(10);
      const f = (x: number) => right<string, number>(x + 5);
      const g = (x: number) => right<string, number>(x * 2);

      const lhs = m.flatMap(f).flatMap(g);
      const rhs = m.flatMap((x) => f(x).flatMap(g));

      expect(lhs.value).toBe(rhs.value);
    });
  });

  describe("IO monad laws", () => {
    it("left identity", () => {
      const f = (x: number) => io(() => x * 2);
      const a = 21;

      const lhs = io(() => a).flatMap(f);
      const rhs = f(a);

      expect(lhs.run()).toBe(rhs.run());
    });

    it("right identity", () => {
      const m = io(() => 42);

      const lhs = m.flatMap((x) => io(() => x));
      const rhs = m;

      expect(lhs.run()).toBe(rhs.run());
    });

    it("associativity", () => {
      const m = io(() => 10);
      const f = (x: number) => io(() => x + 5);
      const g = (x: number) => io(() => x * 2);

      const lhs = m.flatMap(f).flatMap(g);
      const rhs = m.flatMap((x) => f(x).flatMap(g));

      expect(lhs.run()).toBe(rhs.run());
    });
  });
});

// ============================================================================
// For Comprehension Builder Tests
// ============================================================================

describe("For Comprehension Builder", () => {
  describe("For.from() with Option", () => {
    it("should handle single binding", () => {
      // Scala: for { x <- Some(1) } yield x + 1
      const result = For.from({ x: some(1) }).yield(({ x }) => x + 1);

      expect((result as Option<number>).value).toBe(2);
    });

    it("should handle multiple bindings", () => {
      // Scala:
      // for {
      //   x <- Some(1)
      //   y <- Some(2)
      // } yield x + y
      const result = For.from({ x: some(1) })
        .bind("y", () => some(2))
        .yield(({ x, y }) => x + y);

      expect((result as Option<number>).value).toBe(3);
    });

    it("should handle dependent bindings", () => {
      // Scala:
      // for {
      //   x <- Some(10)
      //   y <- Some(x * 2)
      // } yield x + y
      const result = For.from({ x: some(10) })
        .bind("y", ({ x }) => some(x * 2))
        .yield(({ x, y }) => x + y);

      expect((result as Option<number>).value).toBe(30); // 10 + 20
    });

    it("should short-circuit on None", () => {
      // Scala:
      // for {
      //   x <- Some(1)
      //   y <- None
      // } yield x + y
      const result = For.from({ x: some(1) })
        .bind("y", () => none<number>())
        .yield(({ x, y }) => x + y);

      expect((result as Option<number>).value).toBeUndefined();
    });

    it("should handle three bindings", () => {
      // Scala:
      // for {
      //   a <- Some(1)
      //   b <- Some(2)
      //   c <- Some(3)
      // } yield a + b + c
      const result = For.from({ a: some(1) })
        .bind("b", () => some(2))
        .bind("c", () => some(3))
        .yield(({ a, b, c }) => a + b + c);

      expect((result as Option<number>).value).toBe(6);
    });
  });

  describe("For.from() with Either", () => {
    it("should handle happy path", () => {
      // Scala:
      // for {
      //   x <- Right(10)
      //   y <- Right(5)
      // } yield x / y
      const result = For.from({ x: right<string, number>(10) })
        .bind("y", () => right<string, number>(5))
        .yield(({ x, y }) => x / y);

      expect((result as Either<string, number>).value).toBe(2);
    });

    it("should short-circuit on Left", () => {
      // Scala:
      // for {
      //   x <- Right(10)
      //   y <- Left("error")
      // } yield x + y
      const result = For.from({ x: right<string, number>(10) })
        .bind("y", () => left<string, number>("division error"))
        .yield(({ x, y }) => x + y);

      expect((result as Either<string, number>).error).toBe("division error");
    });

    it("should propagate first error", () => {
      // Scala:
      // for {
      //   x <- Left("first error")
      //   y <- Left("second error")
      // } yield x + y
      const result = For.from({ x: left<string, number>("first error") })
        .bind("y", () => left<string, number>("second error"))
        .yield(({ x, y }) => x + y);

      expect((result as Either<string, number>).error).toBe("first error");
    });
  });

  describe("For.from() with IO", () => {
    it("should sequence IO effects", () => {
      // Scala:
      // for {
      //   x <- IO(1)
      //   y <- IO(x + 1)
      // } yield y
      let sideEffectCount = 0;

      const result = For.from({
        x: io(() => {
          sideEffectCount++;
          return 1;
        }),
      })
        .bind("y", ({ x }) =>
          io(() => {
            sideEffectCount++;
            return x + 1;
          }),
        )
        .yield(({ y }) => y);

      // Effects shouldn't run until we call run()
      expect(sideEffectCount).toBe(0);

      // Now run the IO
      const value = (result as IO<number>).run();
      expect(value).toBe(2);
      expect(sideEffectCount).toBe(2);
    });
  });

  describe("For comprehension vs manual flatMap", () => {
    it("should produce equivalent results", () => {
      // Manual flatMap style
      const manual = some(1).flatMap((x) =>
        some(x + 1).flatMap((y) => some(x + y).map((z) => ({ x, y, z }))),
      );

      // For comprehension style
      const forStyle = For.from({ x: some(1) })
        .bind("y", ({ x }) => some(x + 1))
        .bind("z", ({ x, y }) => some(x + y))
        .yield(({ x, y, z }) => ({ x, y, z }));

      expect(
        (manual as Option<{ x: number; y: number; z: number }>).value,
      ).toEqual({
        x: 1,
        y: 2,
        z: 3,
      });
      expect(
        (forStyle as Option<{ x: number; y: number; z: number }>).value,
      ).toEqual({
        x: 1,
        y: 2,
        z: 3,
      });
    });
  });

  describe("comparison with Scala for-comprehension semantics", () => {
    it("matches Scala for-comprehension with <- bindings", () => {
      // Scala:
      // val result = for {
      //   user <- Some(User("Alice", 30))
      //   age <- Some(user.age)
      //   doubled <- Some(age * 2)
      // } yield doubled

      type User = { name: string; age: number };
      const fetchUser = () => some<User>({ name: "Alice", age: 30 });

      const result = For.from({ user: fetchUser() })
        .bind("age", ({ user }) => some(user.age))
        .bind("doubled", ({ age }) => some(age * 2))
        .yield(({ doubled }) => doubled);

      expect((result as Option<number>).value).toBe(60);
    });

    it("handles Scala-style validation pattern", () => {
      // Scala:
      // for {
      //   name <- validateName(input.name)
      //   age <- validateAge(input.age)
      //   email <- validateEmail(input.email)
      // } yield Person(name, age, email)

      const validateName = (n: string) =>
        n.length > 0
          ? right<string, string>(n)
          : left<string, string>("Name required");
      const validateAge = (a: number) =>
        a >= 0 ? right<string, number>(a) : left<string, number>("Invalid age");
      const validateEmail = (e: string) =>
        e.includes("@")
          ? right<string, string>(e)
          : left<string, string>("Invalid email");

      // Valid input
      const validResult = For.from({ name: validateName("Alice") })
        .bind("age", () => validateAge(30))
        .bind("email", () => validateEmail("alice@example.com"))
        .yield(({ name, age, email }) => ({ name, age, email }));

      expect(
        (
          validResult as Either<
            string,
            { name: string; age: number; email: string }
          >
        ).value,
      ).toEqual({
        name: "Alice",
        age: 30,
        email: "alice@example.com",
      });

      // Invalid input - should fail fast on first error
      const invalidResult = For.from({ name: validateName("") })
        .bind("age", () => validateAge(30))
        .bind("email", () => validateEmail("alice@example.com"))
        .yield(({ name, age, email }) => ({ name, age, email }));

      expect((invalidResult as Either<string, unknown>).error).toBe(
        "Name required",
      );
    });
  });
});
