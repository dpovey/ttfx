/**
 * Tests for Advanced Type System Extensions
 *
 * Tests the runtime behavior and type-level APIs for:
 * - Higher-Kinded Types (HKT)
 * - Existential Types
 * - Refinement Types
 * - GADTs
 * - Opaque Type Modules
 * - Phantom Type State Machines
 * - Effect System Annotations
 *
 * Note: Type-Level Arithmetic macros are tested via the transformer
 * (they operate on TypeNodes, not runtime values).
 */

import { describe, it, expect, beforeEach } from "vitest";

// ============================================================================
// HKT Tests
// ============================================================================

import {
  arrayFunctor,
  arrayMonad,
  arrayFoldable,
  promiseFunctor,
  promiseMonad,
  liftA2,
  sequence,
  mapM,
  type Functor,
  type Monad,
  type ArrayHKT,
  type PromiseHKT,
} from "../src/use-cases/type-system/hkt.js";

describe("Higher-Kinded Types (HKT)", () => {
  describe("Functor", () => {
    it("should map over arrays", () => {
      const result = arrayFunctor.map([1, 2, 3] as any, (x: number) => x * 2);
      expect(result).toEqual([2, 4, 6]);
    });

    it("should satisfy identity law", () => {
      const arr = [1, 2, 3] as any;
      const result = arrayFunctor.map(arr, (x: number) => x);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should satisfy composition law", () => {
      const arr = [1, 2, 3] as any;
      const f = (x: number) => x * 2;
      const g = (x: number) => x + 1;

      const composed = arrayFunctor.map(arrayFunctor.map(arr, f), g);
      const direct = arrayFunctor.map(arr, (x: number) => g(f(x)));
      expect(composed).toEqual(direct);
    });

    it("should map over promises", async () => {
      const result = promiseFunctor.map(
        Promise.resolve(42) as any,
        (x: number) => x * 2,
      );
      expect(await result).toBe(84);
    });
  });

  describe("Monad", () => {
    it("should flatMap arrays", () => {
      const result = arrayMonad.flatMap(
        [1, 2, 3] as any,
        (x: number) => [x, x * 10] as any,
      );
      expect(result).toEqual([1, 10, 2, 20, 3, 30]);
    });

    it("should satisfy left identity", () => {
      const f = (x: number) => [x, x + 1] as any;
      const result = arrayMonad.flatMap(arrayMonad.pure(5), f);
      expect(result).toEqual(f(5));
    });

    it("should satisfy right identity", () => {
      const m = [1, 2, 3] as any;
      const result = arrayMonad.flatMap(m, arrayMonad.pure);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should have working ap", () => {
      const fns = [(x: number) => x * 2, (x: number) => x + 10] as any;
      const vals = [1, 2] as any;
      const result = arrayMonad.ap(fns, vals);
      expect(result).toEqual([2, 4, 11, 12]);
    });

    it("should flatMap promises", async () => {
      const result = promiseMonad.flatMap(
        Promise.resolve(42) as any,
        (x: number) => Promise.resolve(x * 2) as any,
      );
      expect(await result).toBe(84);
    });
  });

  describe("Foldable", () => {
    it("should reduce arrays", () => {
      const result = arrayFoldable.reduce(
        [1, 2, 3, 4] as any,
        0,
        (acc: number, x: number) => acc + x,
      );
      expect(result).toBe(10);
    });
  });

  describe("liftA2", () => {
    it("should lift a binary function into Array", () => {
      const result = liftA2(
        arrayMonad as any,
        (a: number, b: number) => a + b,
        [1, 2] as any,
        [10, 20] as any,
      );
      expect(result).toEqual([11, 21, 12, 22]);
    });
  });

  describe("sequence", () => {
    it("should sequence an array of arrays", () => {
      const result = sequence(arrayMonad as any, [
        [1, 2] as any,
        [3, 4] as any,
      ]);
      expect(result).toEqual([
        [1, 3],
        [1, 4],
        [2, 3],
        [2, 4],
      ]);
    });
  });

  describe("mapM", () => {
    it("should map a monadic function over an array", () => {
      const result = mapM(
        arrayMonad as any,
        [1, 2],
        (x: number) => [x, x * 10] as any,
      );
      expect(result).toEqual([
        [1, 2],
        [1, 20],
        [10, 2],
        [10, 20],
      ]);
    });
  });
});

// ============================================================================
// Existential Types Tests
// ============================================================================

import {
  packExists,
  useExists,
  mapExists,
  forEachExists,
  mapExistsList,
  showable,
  showValue,
  comparable,
  serializable,
  type Exists,
  type ShowWitness,
} from "../src/use-cases/type-system/existential.js";

describe("Existential Types", () => {
  describe("packExists / useExists", () => {
    it("should pack and use a value", () => {
      const packed = packExists({ value: 42, label: "answer" });
      const result = useExists(packed, (w) => `${w.label}: ${w.value}`);
      expect(result).toBe("answer: 42");
    });

    it("should hide the concrete type", () => {
      const num = packExists({ value: 42, show: (n: number) => String(n) });
      const str = packExists({ value: "hi", show: (s: string) => s });

      // Both can be stored in the same array (heterogeneous)
      const items = [num, str];

      const results = items.map((item) =>
        useExists(item, ({ value, show }) => show(value)),
      );
      expect(results).toEqual(["42", "hi"]);
    });
  });

  describe("mapExists", () => {
    it("should map over an existential result", () => {
      const packed = packExists({ value: 42 });
      const result = mapExists(
        packed,
        (w) => w.value * 2,
        (n) => `result: ${n}`,
      );
      expect(result).toBe("result: 84");
    });
  });

  describe("Showable pattern", () => {
    it("should create showable values of different types", () => {
      const items = [
        showable(42, (n) => `Number(${n})`),
        showable("hello", (s) => `String("${s}")`),
        showable(true, (b) => `Boolean(${b})`),
        showable([1, 2, 3], (arr) => `Array(${arr.join(", ")})`),
      ];

      const results = items.map(showValue);
      expect(results).toEqual([
        "Number(42)",
        'String("hello")',
        "Boolean(true)",
        "Array(1, 2, 3)",
      ]);
    });
  });

  describe("forEachExists / mapExistsList", () => {
    it("should iterate over existential list", () => {
      const items = [
        packExists({ value: 1, tag: "a" }),
        packExists({ value: 2, tag: "b" }),
      ];

      const collected: string[] = [];
      forEachExists(items, (w) => {
        collected.push(`${w.tag}:${w.value}`);
      });
      expect(collected).toEqual(["a:1", "b:2"]);
    });

    it("should map over existential list", () => {
      const items = [packExists({ value: 10 }), packExists({ value: 20 })];

      const results = mapExistsList(items, (w) => w.value);
      expect(results).toEqual([10, 20]);
    });
  });

  describe("serializable pattern", () => {
    it("should serialize and deserialize", () => {
      const s = serializable(
        { x: 1, y: 2 },
        (p) => JSON.stringify(p),
        (s) => JSON.parse(s),
      );

      useExists(s, ({ value, serialize, deserialize }) => {
        const json = serialize(value);
        expect(json).toBe('{"x":1,"y":2}');
        const restored = deserialize(json);
        expect(restored).toEqual({ x: 1, y: 2 });
      });
    });
  });
});

// ============================================================================
// Refinement Types Tests
// ============================================================================

import {
  refinement,
  composeRefinements,
  Positive,
  NonNegative,
  Byte,
  Port,
  Percentage,
  NonEmpty,
  Trimmed,
  Email,
  Uuid,
  type Refined,
  type Refinement,
} from "../src/use-cases/type-system/refined.js";

describe("Refinement Types", () => {
  describe("refinement()", () => {
    it("should create a refinement from a predicate", () => {
      const Even = refinement<number, "Even">((n) => n % 2 === 0, "Even");
      expect(Even.refine(4)).toBe(4);
      expect(() => Even.refine(3)).toThrow("not a valid Even");
    });

    it("should have an is() type guard", () => {
      const Even = refinement<number, "Even">((n) => n % 2 === 0, "Even");
      expect(Even.is(4)).toBe(true);
      expect(Even.is(3)).toBe(false);
    });

    it("should have a from() that returns undefined on failure", () => {
      const Even = refinement<number, "Even">((n) => n % 2 === 0, "Even");
      expect(Even.from(4)).toBe(4);
      expect(Even.from(3)).toBeUndefined();
    });

    it("should have a safe() that returns a result object", () => {
      const Even = refinement<number, "Even">((n) => n % 2 === 0, "Even");
      expect(Even.safe(4)).toEqual({ ok: true, value: 4 });
      expect(Even.safe(3)).toEqual({
        ok: false,
        error: "3 is not a valid Even",
      });
    });
  });

  describe("composeRefinements()", () => {
    it("should compose two refinements", () => {
      const isPositive = refinement<number, "Positive">(
        (n) => n > 0,
        "Positive",
      );
      const isEven = refinement<number, "Even">((n) => n % 2 === 0, "Even");
      const PositiveEven = composeRefinements(
        isPositive,
        isEven,
        "PositiveEven",
      );

      expect(PositiveEven.refine(4)).toBe(4);
      expect(() => PositiveEven.refine(-2)).toThrow();
      expect(() => PositiveEven.refine(3)).toThrow();
    });
  });

  describe("built-in refinements", () => {
    it("Positive should reject non-positive numbers", () => {
      expect(Positive.refine(1)).toBe(1);
      expect(Positive.refine(0.1)).toBe(0.1);
      expect(() => Positive.refine(0)).toThrow();
      expect(() => Positive.refine(-1)).toThrow();
    });

    it("NonNegative should reject negative numbers", () => {
      expect(NonNegative.refine(0)).toBe(0);
      expect(NonNegative.refine(1)).toBe(1);
      expect(() => NonNegative.refine(-1)).toThrow();
    });

    it("Byte should accept 0-255", () => {
      expect(Byte.refine(0)).toBe(0);
      expect(Byte.refine(255)).toBe(255);
      expect(Byte.refine(128)).toBe(128);
      expect(() => Byte.refine(-1)).toThrow();
      expect(() => Byte.refine(256)).toThrow();
      expect(() => Byte.refine(1.5)).toThrow();
    });

    it("Port should accept 1-65535", () => {
      expect(Port.refine(1)).toBe(1);
      expect(Port.refine(80)).toBe(80);
      expect(Port.refine(8080)).toBe(8080);
      expect(Port.refine(65535)).toBe(65535);
      expect(() => Port.refine(0)).toThrow();
      expect(() => Port.refine(65536)).toThrow();
    });

    it("Percentage should accept 0-100", () => {
      expect(Percentage.refine(0)).toBe(0);
      expect(Percentage.refine(50)).toBe(50);
      expect(Percentage.refine(100)).toBe(100);
      expect(() => Percentage.refine(-1)).toThrow();
      expect(() => Percentage.refine(101)).toThrow();
    });

    it("NonEmpty should reject empty strings", () => {
      expect(NonEmpty.refine("hello")).toBe("hello");
      expect(() => NonEmpty.refine("")).toThrow();
    });

    it("Trimmed should reject untrimmed strings", () => {
      expect(Trimmed.refine("hello")).toBe("hello");
      expect(() => Trimmed.refine(" hello ")).toThrow();
    });

    it("Email should validate email format", () => {
      expect(Email.refine("user@example.com")).toBe("user@example.com");
      expect(() => Email.refine("not-an-email")).toThrow();
      expect(() => Email.refine("@no-local.com")).toThrow();
    });

    it("Uuid should validate UUID format", () => {
      expect(Uuid.refine("550e8400-e29b-41d4-a716-446655440000")).toBe(
        "550e8400-e29b-41d4-a716-446655440000",
      );
      expect(() => Uuid.refine("not-a-uuid")).toThrow();
    });
  });
});

// ============================================================================
// GADT Tests
// ============================================================================

import {
  createGADT,
  type GADTValue,
} from "../src/use-cases/type-system/gadt.js";

describe("GADTs", () => {
  // Define a simple expression GADT
  const Expr = createGADT<{
    Lit: { value: number };
    Bool: { value: boolean };
    Add: { left: GADTValue; right: GADTValue };
    If: { cond: GADTValue; then_: GADTValue; else_: GADTValue };
  }>({
    Lit: ["value"],
    Bool: ["value"],
    Add: ["left", "right"],
    If: ["cond", "then_", "else_"],
  });

  function evalExpr(expr: GADTValue): any {
    return Expr.match(expr, {
      Lit: ({ value }: any) => value,
      Bool: ({ value }: any) => value,
      Add: ({ left, right }: any) => evalExpr(left) + evalExpr(right),
      If: ({ cond, then_, else_ }: any) =>
        evalExpr(cond) ? evalExpr(then_) : evalExpr(else_),
    });
  }

  describe("constructors", () => {
    it("should create tagged values", () => {
      const lit = Expr.Lit({ value: 42 });
      expect(lit.__tag).toBe("Lit");
      expect((lit as any).value).toBe(42);
    });

    it("should create nested values", () => {
      const add = Expr.Add({
        left: Expr.Lit({ value: 1 }),
        right: Expr.Lit({ value: 2 }),
      });
      expect(add.__tag).toBe("Add");
    });
  });

  describe("match", () => {
    it("should evaluate literal expressions", () => {
      expect(evalExpr(Expr.Lit({ value: 42 }))).toBe(42);
      expect(evalExpr(Expr.Bool({ value: true }))).toBe(true);
    });

    it("should evaluate addition", () => {
      const expr = Expr.Add({
        left: Expr.Lit({ value: 10 }),
        right: Expr.Lit({ value: 32 }),
      });
      expect(evalExpr(expr)).toBe(42);
    });

    it("should evaluate nested addition", () => {
      const expr = Expr.Add({
        left: Expr.Add({
          left: Expr.Lit({ value: 1 }),
          right: Expr.Lit({ value: 2 }),
        }),
        right: Expr.Lit({ value: 3 }),
      });
      expect(evalExpr(expr)).toBe(6);
    });

    it("should evaluate if expressions", () => {
      const expr = Expr.If({
        cond: Expr.Bool({ value: true }),
        then_: Expr.Lit({ value: 1 }),
        else_: Expr.Lit({ value: 2 }),
      });
      expect(evalExpr(expr)).toBe(1);

      const expr2 = Expr.If({
        cond: Expr.Bool({ value: false }),
        then_: Expr.Lit({ value: 1 }),
        else_: Expr.Lit({ value: 2 }),
      });
      expect(evalExpr(expr2)).toBe(2);
    });

    it("should throw on non-exhaustive match", () => {
      const value = { __tag: "Unknown" } as GADTValue;
      expect(() =>
        Expr.match(value, {
          Lit: () => 0,
          Bool: () => 0,
          Add: () => 0,
          If: () => 0,
        }),
      ).toThrow("Non-exhaustive match");
    });
  });

  describe("matchPartial", () => {
    it("should match with a default case", () => {
      const result = Expr.matchPartial(
        Expr.Lit({ value: 42 }),
        { Lit: ({ value }: any) => value },
        () => -1,
      );
      expect(result).toBe(42);
    });

    it("should use default for unmatched variants", () => {
      const result = Expr.matchPartial(
        Expr.Bool({ value: true }),
        { Lit: ({ value }: any) => value },
        () => -1,
      );
      expect(result).toBe(-1);
    });
  });

  describe("is", () => {
    it("should check variant tag", () => {
      const lit = Expr.Lit({ value: 42 });
      expect(Expr.is(lit, "Lit")).toBe(true);
      expect(Expr.is(lit, "Bool")).toBe(false);
    });
  });

  describe("variants", () => {
    it("should list all variant names", () => {
      expect(Expr.variants).toEqual(["Lit", "Bool", "Add", "If"]);
    });
  });
});

// ============================================================================
// Opaque Type Module Tests
// ============================================================================

import {
  opaqueModule,
  PositiveInt,
  NonEmptyString,
  EmailAddress,
  SafeUrl,
} from "../src/use-cases/type-system/opaque.js";

describe("Opaque Type Modules", () => {
  describe("opaqueModule()", () => {
    it("should create a module with validation", () => {
      const Age = opaqueModule<number>(
        "Age",
        (n) => Number.isInteger(n) && n >= 0 && n <= 150,
      )({
        toNumber: (n) => n,
        isAdult: (n) => n >= 18,
        toString: (n) => `${n} years`,
      });

      const age = Age.create(25);
      expect(Age.unwrap(age)).toBe(25);
      expect(Age.isValid(25)).toBe(true);
      expect(Age.isValid(-1)).toBe(false);
      expect(Age.isValid(200)).toBe(false);
    });

    it("should throw on invalid creation", () => {
      const Age = opaqueModule<number>(
        "Age",
        (n) => n >= 0 && n <= 150,
      )({
        toNumber: (n) => n,
      });

      expect(() => Age.create(-1)).toThrow("Invalid Age");
    });

    it("should support tryCreate", () => {
      const Age = opaqueModule<number>(
        "Age",
        (n) => n >= 0 && n <= 150,
      )({
        toNumber: (n) => n,
      });

      expect(Age.tryCreate(25)).toBeDefined();
      expect(Age.tryCreate(-1)).toBeUndefined();
    });

    it("should wrap operations to accept opaque types", () => {
      const Counter = opaqueModule<number>(
        "Counter",
        (n) => n >= 0,
      )({
        value: (n) => n,
        increment: (n) => n + 1,
        decrement: (n) => Math.max(0, n - 1),
        add: (n, amount: number) => n + amount,
      });

      const c = Counter.create(0);
      expect(Counter.value(c)).toBe(0);
      expect(Counter.increment(c)).toBe(1);
      expect(Counter.add(c, 5)).toBe(5);
    });
  });

  describe("built-in opaque modules", () => {
    it("PositiveInt should validate positive integers", () => {
      const id = PositiveInt.create(42);
      expect(PositiveInt.toNumber(id)).toBe(42);
      expect(() => PositiveInt.create(0)).toThrow();
      expect(() => PositiveInt.create(-1)).toThrow();
      expect(() => PositiveInt.create(1.5)).toThrow();
    });

    it("NonEmptyString should validate non-empty strings", () => {
      const s = NonEmptyString.create("hello");
      expect(NonEmptyString.toString(s)).toBe("hello");
      expect(NonEmptyString.length(s)).toBe(5);
      expect(() => NonEmptyString.create("")).toThrow();
    });

    it("EmailAddress should validate emails", () => {
      const email = EmailAddress.create("user@example.com");
      expect(EmailAddress.domain(email)).toBe("example.com");
      expect(EmailAddress.local(email)).toBe("user");
      expect(() => EmailAddress.create("not-an-email")).toThrow();
    });

    it("SafeUrl should validate URLs", () => {
      const url = SafeUrl.create("https://example.com/path");
      expect(SafeUrl.hostname(url)).toBe("example.com");
      expect(SafeUrl.pathname(url)).toBe("/path");
      expect(SafeUrl.protocol(url)).toBe("https:");
      expect(() => SafeUrl.create("not-a-url")).toThrow();
    });
  });
});

// ============================================================================
// Phantom Type State Machine Tests
// ============================================================================

import {
  createStateMachine,
  createBuilder,
  type StateMachineInstance,
} from "../src/use-cases/type-system/phantom.js";

describe("Phantom Type State Machines", () => {
  describe("createStateMachine()", () => {
    const TrafficLight = createStateMachine<
      {
        red: { toGreen: "green" };
        green: { toYellow: "yellow" };
        yellow: { toRed: "red" };
      },
      { timer: number }
    >({
      initial: "red",
      initialData: { timer: 0 },
      transitions: {
        toGreen: (data) => ({ timer: data.timer + 1 }),
        toYellow: (data) => ({ timer: data.timer + 1 }),
        toRed: (data) => ({ timer: data.timer + 1 }),
      },
    });

    it("should create in initial state", () => {
      const light = TrafficLight.create();
      expect(light.state).toBe("red");
      expect(light.data.timer).toBe(0);
    });

    it("should transition between states", () => {
      let light = TrafficLight.create();
      expect(light.state).toBe("red");

      light = TrafficLight.toGreen(light) as any;
      expect(light.data.timer).toBe(1);

      light = TrafficLight.toYellow(light) as any;
      expect(light.data.timer).toBe(2);

      light = TrafficLight.toRed(light) as any;
      expect(light.data.timer).toBe(3);
    });

    it("should check state with is()", () => {
      const light = TrafficLight.create();
      expect(TrafficLight.is(light, "red")).toBe(true);
      expect(TrafficLight.is(light, "green")).toBe(false);
    });

    it("should get state and data", () => {
      const light = TrafficLight.create();
      expect(TrafficLight.getState(light)).toBe("red");
      expect(TrafficLight.getData(light)).toEqual({ timer: 0 });
    });
  });

  describe("createBuilder()", () => {
    it("should build objects step by step", () => {
      interface UserFields {
        name: string;
        email: string;
        age: number;
      }

      const user = createBuilder<UserFields>()
        .set("name", "Alice")
        .set("email", "alice@example.com")
        .set("age", 30)
        .build();

      expect(user).toEqual({
        name: "Alice",
        email: "alice@example.com",
        age: 30,
      });
    });

    it("should return partial state", () => {
      interface Config {
        host: string;
        port: number;
      }

      const partial = createBuilder<Config>()
        .set("host", "localhost")
        .partial();

      expect(partial).toEqual({ host: "localhost" });
    });

    it("should allow overwriting fields", () => {
      interface Config {
        host: string;
        port: number;
      }

      const config = createBuilder<Config>()
        .set("host", "localhost")
        .set("port", 3000)
        .set("host", "0.0.0.0")
        .build();

      expect(config).toEqual({ host: "0.0.0.0", port: 3000 });
    });
  });
});

// ============================================================================
// Effect System Tests
// ============================================================================

import {
  registerPure,
  registerEffect,
  checkEffectCall,
  effectRegistry,
  pure,
  io,
  assertPure,
} from "../src/use-cases/type-system/effects.js";

describe("Effect System Annotations", () => {
  beforeEach(() => {
    effectRegistry.clear();
  });

  describe("effect registry", () => {
    it("should register pure functions", () => {
      registerPure("add");
      const annotation = effectRegistry.get("add");
      expect(annotation).toBeDefined();
      expect(annotation!.pure).toBe(true);
      expect(annotation!.effects.size).toBe(0);
    });

    it("should register effectful functions", () => {
      registerEffect("readFile", ["io"]);
      const annotation = effectRegistry.get("readFile");
      expect(annotation).toBeDefined();
      expect(annotation!.pure).toBe(false);
      expect(annotation!.effects.has("io")).toBe(true);
    });

    it("should register multiple effects", () => {
      registerEffect("fetchAndLog", ["io", "async", "console"]);
      const annotation = effectRegistry.get("fetchAndLog");
      expect(annotation!.effects.size).toBe(3);
    });
  });

  describe("checkEffectCall", () => {
    it("should allow pure calling pure", () => {
      registerPure("add");
      registerPure("multiply");
      expect(checkEffectCall("add", "multiply")).toBeUndefined();
    });

    it("should allow effectful calling pure", () => {
      registerEffect("readFile", ["io"]);
      registerPure("add");
      expect(checkEffectCall("readFile", "add")).toBeUndefined();
    });

    it("should reject pure calling effectful", () => {
      registerPure("process");
      registerEffect("readFile", ["io"]);
      const error = checkEffectCall("process", "readFile");
      expect(error).toBeDefined();
      expect(error).toContain("@pure function 'process'");
      expect(error).toContain("readFile");
    });

    it("should allow effectful calling effectful with matching effects", () => {
      registerEffect("loadConfig", ["io"]);
      registerEffect("readFile", ["io"]);
      expect(checkEffectCall("loadConfig", "readFile")).toBeUndefined();
    });

    it("should reject effectful calling effectful with missing effects", () => {
      registerEffect("loadConfig", ["io"]);
      registerEffect("fetchData", ["async"]);
      const error = checkEffectCall("loadConfig", "fetchData");
      expect(error).toBeDefined();
      expect(error).toContain("async");
    });

    it("should allow unknown functions (open world)", () => {
      registerPure("add");
      expect(checkEffectCall("add", "unknownFn")).toBeUndefined();
      expect(checkEffectCall("unknownFn", "add")).toBeUndefined();
    });
  });

  describe("runtime helpers", () => {
    it("pure() should be identity", () => {
      expect(pure(42)).toBe(42);
      expect(pure("hello")).toBe("hello");
    });

    it("io() should be identity", () => {
      expect(io(42)).toBe(42);
    });

    it("assertPure() should return the function", () => {
      const fn = (x: number) => x * 2;
      expect(assertPure(fn)).toBe(fn);
    });
  });
});

// ============================================================================
// Type-Level Arithmetic (import to trigger registration)
// ============================================================================

import "../src/use-cases/type-system/type-arithmetic.js";

// ============================================================================
// Registry Integration Tests
// ============================================================================

import { globalRegistry } from "../src/core/registry.js";

describe("Registry Integration", () => {
  it("should have HKT macros registered", () => {
    expect(globalRegistry.getAttribute("hkt")).toBeDefined();
    expect(globalRegistry.getExpression("hktInstance")).toBeDefined();
  });

  it("should have existential macros registered", () => {
    expect(globalRegistry.getAttribute("existential")).toBeDefined();
    expect(globalRegistry.getExpression("packExists")).toBeDefined();
    expect(globalRegistry.getExpression("useExists")).toBeDefined();
  });

  it("should have refinement macros registered", () => {
    expect(globalRegistry.getExpression("refine")).toBeDefined();
    expect(globalRegistry.getExpression("unsafeRefine")).toBeDefined();
  });

  it("should have GADT macros registered", () => {
    expect(globalRegistry.getExpression("gadt")).toBeDefined();
    expect(globalRegistry.getExpression("matchGadt")).toBeDefined();
  });

  it("should have type arithmetic macros registered", () => {
    expect(globalRegistry.getType("Add")).toBeDefined();
    expect(globalRegistry.getType("Sub")).toBeDefined();
    expect(globalRegistry.getType("Mul")).toBeDefined();
    expect(globalRegistry.getType("Div")).toBeDefined();
    expect(globalRegistry.getType("Mod")).toBeDefined();
    expect(globalRegistry.getType("Pow")).toBeDefined();
    expect(globalRegistry.getType("Negate")).toBeDefined();
    expect(globalRegistry.getType("Abs")).toBeDefined();
    expect(globalRegistry.getType("Max")).toBeDefined();
    expect(globalRegistry.getType("Min")).toBeDefined();
    expect(globalRegistry.getType("Lt")).toBeDefined();
    expect(globalRegistry.getType("Lte")).toBeDefined();
    expect(globalRegistry.getType("Gt")).toBeDefined();
    expect(globalRegistry.getType("Gte")).toBeDefined();
    expect(globalRegistry.getType("NumEq")).toBeDefined();
    expect(globalRegistry.getType("Increment")).toBeDefined();
    expect(globalRegistry.getType("Decrement")).toBeDefined();
    expect(globalRegistry.getType("IsEven")).toBeDefined();
    expect(globalRegistry.getType("IsOdd")).toBeDefined();
  });

  it("should have opaque module macro registered", () => {
    expect(globalRegistry.getExpression("opaqueModule")).toBeDefined();
  });

  it("should have phantom/state machine macros registered", () => {
    expect(globalRegistry.getAttribute("phantom")).toBeDefined();
    expect(globalRegistry.getExpression("stateMachine")).toBeDefined();
  });

  it("should have effect system macros registered", () => {
    expect(globalRegistry.getAttribute("pure")).toBeDefined();
    expect(globalRegistry.getAttribute("effect")).toBeDefined();
  });
});
