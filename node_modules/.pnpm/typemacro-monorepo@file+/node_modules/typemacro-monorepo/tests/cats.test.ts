/**
 * Comprehensive Tests for Cats FP System
 *
 * Tests covering:
 * - Data types: Option, Either, List, NonEmptyList, Validated
 * - Monad transformers: State, Reader, Writer, Id
 * - IO runtime: IO, Ref, Deferred
 * - Typeclasses: Functor, Monad, Applicative, etc.
 * - Syntax: pipe, flow, do-comprehension
 * - Examples: validation, parser
 */

import { describe, it, expect, beforeEach } from "vitest";

// Data Types - Option
import {
  Some,
  None,
  isSome,
  isNone,
  fromNullable,
  map as optionMap,
  flatMap as optionFlatMap,
  getOrElse as optionGetOrElse,
  filter as optionFilter,
  toEither as optionToEither,
} from "../src/use-cases/cats/data/option";

// Data Types - Either
import {
  Left,
  Right,
  isLeft,
  isRight,
  map as eitherMap,
  mapLeft as eitherMapLeft,
  flatMap as eitherFlatMap,
  getOrElse as eitherGetOrElse,
  swap as eitherSwap,
  toOption as eitherToOption,
} from "../src/use-cases/cats/data/either";

// Data Types - List
import {
  Cons,
  Nil,
  empty as listEmpty,
  fromArray as listFromArray,
  toArray as listToArray,
  map as listMap,
  flatMap as listFlatMap,
  foldLeft as listFoldLeft,
  foldRight as listFoldRight,
  head as listHead,
  tail as listTail,
  filter as listFilter,
  reverse as listReverse,
  length as listLength,
  isEmpty as listIsEmpty,
} from "../src/use-cases/cats/data/list";

// Data Types - NonEmptyList
import {
  NonEmptyList,
  of as nelOf,
  fromArray as nelFromArray,
  toArray as nelToArray,
  head as nelHead,
  last as nelLast,
  reduce as nelReduce,
} from "../src/use-cases/cats/data/nonempty-list";

// Data Types - Validated
import {
  Valid,
  Invalid,
  valid,
  invalid,
  validNel,
  invalidNel,
  isValid,
  isInvalid,
  map2,
  map3,
  getOrElse as validatedGetOrElse,
  toEither as validatedToEither,
} from "../src/use-cases/cats/data/validated";

// Monad Transformers
import { State } from "../src/use-cases/cats/data/state";
import { Reader } from "../src/use-cases/cats/data/reader";
import { Writer, LogWriterMonoid } from "../src/use-cases/cats/data/writer";
import { Id } from "../src/use-cases/cats/data/id";

// IO
import { IO, runIO, runIOSync } from "../src/use-cases/cats/io/io";
import { Ref } from "../src/use-cases/cats/io/ref";
import { Deferred } from "../src/use-cases/cats/io/deferred";

// Syntax
import {
  pipe,
  flow,
  identity,
  constant,
  compose,
} from "../src/use-cases/cats/syntax/pipe";

// Typeclasses
import {
  semigroupString,
  semigroupSum,
  monoidString,
  monoidSum,
  combineAllMonoid,
} from "../src/use-cases/cats/typeclasses/semigroup";

import {
  eqNumber,
  eqString,
  ordNumber,
} from "../src/use-cases/cats/typeclasses/eq";

import { showNumber, showString } from "../src/use-cases/cats/typeclasses/show";

// ============================================================================
// Option Tests
// ============================================================================

describe("Option", () => {
  describe("constructors", () => {
    it("Some creates a Some value", () => {
      const opt = Some(42);
      expect(isSome(opt)).toBe(true);
      expect(opt.value).toBe(42);
    });

    it("None creates a None value", () => {
      expect(isNone(None)).toBe(true);
    });

    it("fromNullable creates Some for non-null values", () => {
      expect(isSome(fromNullable(42))).toBe(true);
    });

    it("fromNullable creates None for null/undefined", () => {
      expect(isNone(fromNullable(null))).toBe(true);
      expect(isNone(fromNullable(undefined))).toBe(true);
    });
  });

  describe("Functor", () => {
    it("map transforms Some values", () => {
      const result = optionMap(Some(2), (x) => x * 3);
      expect(result).toEqual(Some(6));
    });

    it("map returns None for None", () => {
      const result = optionMap(None, (x: number) => x * 3);
      expect(result).toEqual(None);
    });

    it("map preserves identity", () => {
      const opt = Some(42);
      expect(optionMap(opt, identity)).toEqual(opt);
    });

    it("map composes", () => {
      const f = (x: number) => x + 1;
      const g = (x: number) => x * 2;
      const opt = Some(5);
      expect(optionMap(optionMap(opt, f), g)).toEqual(
        optionMap(opt, (x) => g(f(x))),
      );
    });
  });

  describe("Monad", () => {
    it("flatMap chains Some values", () => {
      const result = optionFlatMap(Some(2), (x) => Some(x * 3));
      expect(result).toEqual(Some(6));
    });

    it("flatMap short-circuits on None", () => {
      const result = optionFlatMap(None, (_: number) => Some(42));
      expect(result).toEqual(None);
    });

    it("flatMap propagates None from function", () => {
      const result = optionFlatMap(Some(2), () => None);
      expect(result).toEqual(None);
    });

    it("satisfies left identity", () => {
      const f = (x: number) => Some(x * 2);
      expect(optionFlatMap(Some(5), f)).toEqual(f(5));
    });

    it("satisfies right identity", () => {
      const opt = Some(5);
      expect(optionFlatMap(opt, Some)).toEqual(opt);
    });
  });

  describe("utilities", () => {
    it("getOrElse returns value for Some", () => {
      expect(optionGetOrElse(Some(42), () => 0)).toBe(42);
    });

    it("getOrElse returns default for None", () => {
      expect(optionGetOrElse(None, () => 99)).toBe(99);
    });

    it("filter keeps matching values", () => {
      expect(optionFilter(Some(10), (x) => x > 5)).toEqual(Some(10));
    });

    it("filter removes non-matching values", () => {
      expect(optionFilter(Some(3), (x) => x > 5)).toEqual(None);
    });

    it("toEither converts correctly", () => {
      expect(optionToEither(Some(42), () => "error")).toEqual(Right(42));
      expect(optionToEither(None, () => "error")).toEqual(Left("error"));
    });
  });
});

// ============================================================================
// Either Tests
// ============================================================================

describe("Either", () => {
  describe("constructors", () => {
    it("Right creates a Right value", () => {
      const e = Right(42);
      expect(isRight(e)).toBe(true);
      expect(e.right).toBe(42);
    });

    it("Left creates a Left value", () => {
      const e = Left("error");
      expect(isLeft(e)).toBe(true);
      expect(e.left).toBe("error");
    });
  });

  describe("Functor", () => {
    it("map transforms Right values", () => {
      expect(eitherMap(Right(2), (x) => x * 3)).toEqual(Right(6));
    });

    it("map preserves Left values", () => {
      expect(eitherMap(Left("err"), (x: number) => x * 3)).toEqual(Left("err"));
    });
  });

  describe("Monad", () => {
    it("flatMap chains Right values", () => {
      const result = eitherFlatMap(Right(2), (x) => Right(x * 3));
      expect(result).toEqual(Right(6));
    });

    it("flatMap short-circuits on Left", () => {
      const result = eitherFlatMap(Left("err"), (_: number) => Right(42));
      expect(result).toEqual(Left("err"));
    });
  });

  describe("utilities", () => {
    it("getOrElse returns value for Right", () => {
      expect(eitherGetOrElse(Right(42), () => 0)).toBe(42);
    });

    it("getOrElse returns default for Left", () => {
      expect(eitherGetOrElse(Left("err"), () => 99)).toBe(99);
    });

    it("swap exchanges Left and Right", () => {
      expect(eitherSwap(Right(42))).toEqual(Left(42));
      expect(eitherSwap(Left("err"))).toEqual(Right("err"));
    });

    it("toOption converts correctly", () => {
      expect(eitherToOption(Right(42))).toEqual(Some(42));
      expect(eitherToOption(Left("err"))).toEqual(None);
    });
  });

  describe("mapLeft", () => {
    it("transforms Left values", () => {
      expect(eitherMapLeft(Left("err"), (s) => s.toUpperCase())).toEqual(
        Left("ERR"),
      );
    });

    it("preserves Right values", () => {
      expect(eitherMapLeft(Right(42), (s: string) => s.toUpperCase())).toEqual(
        Right(42),
      );
    });
  });
});

// ============================================================================
// List Tests
// ============================================================================

describe("List", () => {
  describe("constructors", () => {
    it("fromArray creates list from array", () => {
      const list = listFromArray([1, 2, 3]);
      expect(listToArray(list)).toEqual([1, 2, 3]);
    });

    it("empty creates empty list", () => {
      expect(listIsEmpty(listEmpty())).toBe(true);
    });

    it("Cons adds element to front", () => {
      const list = Cons(1, Cons(2, Cons(3, Nil)));
      expect(listToArray(list)).toEqual([1, 2, 3]);
    });
  });

  describe("Functor", () => {
    it("map transforms all elements", () => {
      const list = listFromArray([1, 2, 3]);
      const result = listMap(list, (x) => x * 2);
      expect(listToArray(result)).toEqual([2, 4, 6]);
    });

    it("map on empty list returns empty", () => {
      const result = listMap(listEmpty<number>(), (x) => x * 2);
      expect(listIsEmpty(result)).toBe(true);
    });
  });

  describe("Monad", () => {
    it("flatMap flattens nested lists", () => {
      const list = listFromArray([1, 2]);
      const result = listFlatMap(list, (x) => listFromArray([x, x * 10]));
      expect(listToArray(result)).toEqual([1, 10, 2, 20]);
    });
  });

  describe("Foldable", () => {
    it("foldLeft accumulates left-to-right", () => {
      const list = listFromArray([1, 2, 3]);
      const result = listFoldLeft(list, 0, (acc, x) => acc + x);
      expect(result).toBe(6);
    });

    it("foldRight accumulates right-to-left", () => {
      const list = listFromArray([1, 2, 3]);
      const result = listFoldRight(list, "", (x, acc) => String(x) + acc);
      expect(result).toBe("123");
    });
  });

  describe("utilities", () => {
    it("head returns first element", () => {
      expect(listHead(listFromArray([1, 2, 3]))).toEqual(Some(1));
      expect(listHead(listEmpty())).toEqual(None);
    });

    it("tail returns Option of rest of list", () => {
      const result = listTail(listFromArray([1, 2, 3]));
      expect(isSome(result)).toBe(true);
      if (isSome(result)) {
        expect(listToArray(result.value)).toEqual([2, 3]);
      }
    });

    it("filter keeps matching elements", () => {
      const list = listFromArray([1, 2, 3, 4, 5]);
      const result = listFilter(list, (x) => x % 2 === 0);
      expect(listToArray(result)).toEqual([2, 4]);
    });

    it("reverse reverses the list", () => {
      expect(listToArray(listReverse(listFromArray([1, 2, 3])))).toEqual([
        3, 2, 1,
      ]);
    });

    it("length returns correct count", () => {
      expect(listLength(listFromArray([1, 2, 3]))).toBe(3);
      expect(listLength(listEmpty())).toBe(0);
    });
  });
});

// ============================================================================
// NonEmptyList Tests
// ============================================================================

describe("NonEmptyList", () => {
  describe("constructors", () => {
    it("of creates NEL from values", () => {
      const n = nelOf(1, 2, 3);
      expect(nelToArray(n)).toEqual([1, 2, 3]);
    });

    it("fromArray returns Some for non-empty array", () => {
      const result = nelFromArray([1, 2, 3]);
      expect(isSome(result)).toBe(true);
      if (isSome(result)) {
        expect(nelToArray(result.value)).toEqual([1, 2, 3]);
      }
    });

    it("fromArray returns None for empty array", () => {
      expect(nelFromArray([])).toEqual(None);
    });
  });

  describe("guaranteed operations", () => {
    it("head always returns a value", () => {
      const n = nelOf(1, 2, 3);
      expect(nelHead(n)).toBe(1);
    });

    it("last always returns a value", () => {
      const n = nelOf(1, 2, 3);
      expect(nelLast(n)).toBe(3);
    });

    it("reduce always has at least one element", () => {
      const n = nelOf(1, 2, 3);
      const result = nelReduce(n, (a, b) => a + b);
      expect(result).toBe(6);
    });
  });
});

// ============================================================================
// Validated Tests
// ============================================================================

describe("Validated", () => {
  describe("constructors", () => {
    it("valid creates Valid value", () => {
      const v = valid(42);
      expect(isValid(v)).toBe(true);
    });

    it("invalid creates Invalid value", () => {
      const v = invalid("error");
      expect(isInvalid(v)).toBe(true);
    });

    it("validNel wraps in NonEmptyList", () => {
      const v = validNel(42);
      expect(isValid(v)).toBe(true);
    });

    it("invalidNel wraps error in NonEmptyList", () => {
      const v = invalidNel("error");
      expect(isInvalid(v)).toBe(true);
      if (isInvalid(v)) {
        expect(nelHead(v.error)).toBe("error");
      }
    });
  });

  describe("Applicative (error accumulation)", () => {
    it("map2 combines valid values", () => {
      const result = map2(validNel(2), validNel(3), (a, b) => a + b);
      expect(isValid(result)).toBe(true);
      if (isValid(result)) {
        expect(result.value).toBe(5);
      }
    });

    it("mapN combines multiple validated values", () => {
      const result = map3(
        validNel(1),
        validNel(2),
        validNel(3),
        (a, b, c) => a + b + c,
      );
      expect(isValid(result)).toBe(true);
      if (isValid(result)) {
        expect(result.value).toBe(6);
      }
    });
  });

  describe("utilities", () => {
    it("getOrElse returns value for Valid", () => {
      expect(validatedGetOrElse(valid(42), () => 0)).toBe(42);
    });

    it("getOrElse returns default for Invalid", () => {
      expect(validatedGetOrElse(invalid("err"), () => 99)).toBe(99);
    });

    it("toEither converts correctly", () => {
      expect(validatedToEither(valid(42))).toEqual(Right(42));
      expect(validatedToEither(invalid("err"))).toEqual(Left("err"));
    });
  });
});

// ============================================================================
// State Tests
// ============================================================================

describe("State", () => {
  describe("basic operations", () => {
    it("pure returns value without changing state", () => {
      const s = State.pure<number, string>("hello");
      const [value, state] = s.run(42);
      expect(value).toBe("hello");
      expect(state).toBe(42);
    });

    it("get retrieves state", () => {
      const [value, state] = State.get<number>().run(42);
      expect(value).toBe(42);
      expect(state).toBe(42);
    });

    it("set updates state", () => {
      const [value, state] = State.set<number>(99).run(42);
      expect(value).toBe(undefined);
      expect(state).toBe(99);
    });

    it("modify transforms state", () => {
      const [_, state] = State.modify<number>((n) => n * 2).run(21);
      expect(state).toBe(42);
    });
  });

  describe("Monad", () => {
    it("flatMap sequences stateful computations", () => {
      const computation = State.get<number>()
        .flatMap((n) => State.set(n * 2))
        .flatMap(() => State.get<number>())
        .flatMap((n) => State.pure<number, number>(n + 1));

      const [value, state] = computation.run(10);
      expect(value).toBe(21);
      expect(state).toBe(20);
    });
  });

  describe("utilities", () => {
    it("runA returns only the value", () => {
      expect(State.pure<number, string>("hello").runA(42)).toBe("hello");
    });

    it("runS returns only the state", () => {
      expect(State.set<number>(99).runS(42)).toBe(99);
    });
  });
});

// ============================================================================
// Reader Tests
// ============================================================================

describe("Reader", () => {
  interface Config {
    readonly prefix: string;
    readonly suffix: string;
  }

  describe("basic operations", () => {
    it("pure returns value ignoring environment", () => {
      const r = Reader.pure<Config, number>(42);
      expect(r.run({ prefix: "", suffix: "" })).toBe(42);
    });

    it("ask retrieves the environment", () => {
      const r = Reader.ask<Config>();
      const config: Config = { prefix: "pre_", suffix: "_suf" };
      expect(r.run(config)).toBe(config);
    });

    it("asks extracts from environment", () => {
      const r = Reader.asks<Config, string>((c) => c.prefix);
      expect(r.run({ prefix: "hello", suffix: "" })).toBe("hello");
    });
  });

  describe("Monad", () => {
    it("flatMap sequences readers", () => {
      const r = Reader.asks<Config, string>((c) => c.prefix).flatMap((pre) =>
        Reader.asks<Config, string>((c) => pre + "middle" + c.suffix),
      );
      expect(r.run({ prefix: "start_", suffix: "_end" })).toBe(
        "start_middle_end",
      );
    });
  });

  describe("local", () => {
    it("modifies environment locally", () => {
      const inner = Reader.asks<Config, string>((c) => c.prefix);
      const outer = inner.local<Config>((c) => ({
        ...c,
        prefix: c.prefix.toUpperCase(),
      }));
      expect(outer.run({ prefix: "hello", suffix: "" })).toBe("HELLO");
    });
  });
});

// ============================================================================
// Writer Tests
// ============================================================================

describe("Writer", () => {
  describe("basic operations", () => {
    it("pure creates writer with value and empty log", () => {
      const w = Writer.pure(42, LogWriterMonoid);
      expect(w.value()).toBe(42);
      expect(w.written()).toEqual([]);
    });

    it("tell creates writer with log entry", () => {
      const w = Writer.tell(["hello"]);
      expect(w.value()).toBe(undefined);
      expect(w.written()).toEqual(["hello"]);
    });
  });

  describe("Monad", () => {
    it("flatMap combines logs", () => {
      const w = Writer.writer(2, ["started"])
        .flatMap((n) => Writer.writer(n * 2, ["doubled"]), LogWriterMonoid)
        .flatMap((n) => Writer.writer(n + 1, ["incremented"]), LogWriterMonoid);

      expect(w.value()).toBe(5);
      expect(w.written()).toEqual(["started", "doubled", "incremented"]);
    });
  });

  describe("utilities", () => {
    it("run returns [value, log] tuple", () => {
      const w = Writer.writer(42, ["log"]);
      expect(w.run()).toEqual([42, ["log"]]);
    });

    it("listen exposes the log alongside value", () => {
      const w = Writer.writer(42, ["log"]).listen();
      expect(w.value()).toEqual([42, ["log"]]);
    });
  });
});

// ============================================================================
// Id Tests
// ============================================================================

describe("Id", () => {
  it("pure wraps a value", () => {
    const id = Id.pure(42);
    expect(id.value).toBe(42);
  });

  it("map transforms the value", () => {
    const result = Id.pure(2).map((x) => x * 3);
    expect(result.value).toBe(6);
  });

  it("flatMap chains computations", () => {
    const result = Id.pure(2).flatMap((x) => Id.pure(x * 3));
    expect(result.value).toBe(6);
  });

  it("extract retrieves the value", () => {
    expect(Id.pure(42).extract()).toBe(42);
  });
});

// ============================================================================
// IO Tests
// ============================================================================

describe("IO", () => {
  describe("constructors", () => {
    it("pure creates IO with value", async () => {
      const result = await runIO(IO.pure(42));
      expect(result).toBe(42);
    });

    it("delay defers computation", async () => {
      let called = false;
      const io = IO.delay(() => {
        called = true;
        return 42;
      });
      expect(called).toBe(false);
      const result = await runIO(io);
      expect(called).toBe(true);
      expect(result).toBe(42);
    });
  });

  describe("Functor", () => {
    it("map transforms IO value", async () => {
      const result = await runIO(IO.map(IO.pure(2), (x) => x * 3));
      expect(result).toBe(6);
    });
  });

  describe("Monad", () => {
    it("flatMap sequences IOs", async () => {
      const result = await runIO(IO.flatMap(IO.pure(2), (x) => IO.pure(x * 3)));
      expect(result).toBe(6);
    });
  });

  describe("error handling", () => {
    it("raiseError creates failed IO", async () => {
      const io = IO.raiseError(new Error("test error"));
      await expect(runIO(io)).rejects.toThrow("test error");
    });

    it("handleError recovers from errors", async () => {
      const io = IO.handleError(IO.raiseError(new Error("test")), () =>
        IO.pure(42),
      );
      const result = await runIO(io);
      expect(result).toBe(42);
    });

    it("attempt converts error to Either", async () => {
      const successful = await runIO(IO.attempt(IO.pure(42)));
      expect(isRight(successful)).toBe(true);

      const failed = await runIO(IO.attempt(IO.raiseError(new Error("oops"))));
      expect(isLeft(failed)).toBe(true);
    });
  });

  describe("utilities", () => {
    it("sequence combines IOs", async () => {
      const ios = [IO.pure(1), IO.pure(2), IO.pure(3)];
      const result = await runIO(IO.sequence(ios));
      expect(result).toEqual([1, 2, 3]);
    });

    it("traverse maps and sequences", async () => {
      const result = await runIO(IO.traverse([1, 2, 3], (x) => IO.pure(x * 2)));
      expect(result).toEqual([2, 4, 6]);
    });
  });

  describe("runIOSync", () => {
    it("runs synchronous IOs", () => {
      const result = runIOSync(IO.map(IO.pure(2), (x) => x * 3));
      expect(result).toBe(6);
    });

    it("throws on async IOs", () => {
      const asyncIO = IO.fromPromise(() => Promise.resolve(42));
      expect(() => runIOSync(asyncIO)).toThrow();
    });
  });
});

// ============================================================================
// Ref Tests
// ============================================================================

describe("Ref", () => {
  it("get retrieves initial value", async () => {
    const io = IO.flatMap(Ref.make(42), (ref) => ref.get());
    expect(await runIO(io)).toBe(42);
  });

  it("set updates value", async () => {
    const io = IO.flatMap(Ref.make(42), (ref) =>
      IO.flatMap(ref.set(99), () => ref.get()),
    );
    expect(await runIO(io)).toBe(99);
  });

  it("update modifies value", async () => {
    const io = IO.flatMap(Ref.make(42), (ref) =>
      IO.flatMap(
        ref.update((n) => n * 2),
        () => ref.get(),
      ),
    );
    expect(await runIO(io)).toBe(84);
  });

  it("getAndSet returns old value", async () => {
    const io = IO.flatMap(Ref.make(42), (ref) => ref.getAndSet(99));
    expect(await runIO(io)).toBe(42);
  });

  it("modify returns derived value and updates state", async () => {
    const io = IO.flatMap(Ref.make(42), (ref) =>
      IO.flatMap(
        ref.modify((n) => [n.toString(), n * 2]),
        (str) =>
          IO.flatMap(ref.get(), (newVal) => IO.pure([str, newVal] as const)),
      ),
    );
    const [str, val] = await runIO(io);
    expect(str).toBe("42");
    expect(val).toBe(84);
  });
});

// ============================================================================
// Deferred Tests
// ============================================================================

describe("Deferred", () => {
  it("get waits for completion", async () => {
    const io = IO.flatMap(Deferred.make<number>(), (d) =>
      IO.flatMap(d.complete(42), () => d.get()),
    );
    expect(await runIO(io)).toBe(42);
  });

  it("tryGet returns None before completion", async () => {
    const io = IO.flatMap(Deferred.make<number>(), (d) => d.tryGet());
    const result = await runIO(io);
    expect(isNone(result)).toBe(true);
  });

  it("tryGet returns Some after completion", async () => {
    const io = IO.flatMap(Deferred.make<number>(), (d) =>
      IO.flatMap(d.complete(42), () => d.tryGet()),
    );
    const result = await runIO(io);
    expect(isSome(result)).toBe(true);
    if (isSome(result)) {
      expect(result.value).toBe(42);
    }
  });

  it("complete returns false if already completed", async () => {
    const io = IO.flatMap(Deferred.make<number>(), (d) =>
      IO.flatMap(d.complete(1), () => d.complete(2)),
    );
    expect(await runIO(io)).toBe(false);
  });
});

// ============================================================================
// Pipe & Flow Tests
// ============================================================================

describe("pipe", () => {
  it("passes value through single function", () => {
    expect(pipe(5, (x) => x * 2)).toBe(10);
  });

  it("passes value through multiple functions", () => {
    expect(
      pipe(
        5,
        (x) => x * 2,
        (x) => x + 1,
        (x) => x.toString(),
      ),
    ).toBe("11");
  });

  it("returns value unchanged with no functions", () => {
    expect(pipe(42)).toBe(42);
  });
});

describe("flow", () => {
  it("composes single function", () => {
    const f = flow((x: number) => x * 2);
    expect(f(5)).toBe(10);
  });

  it("composes multiple functions left-to-right", () => {
    const f = flow(
      (x: number) => x * 2,
      (x) => x + 1,
      (x) => x.toString(),
    );
    expect(f(5)).toBe("11");
  });
});

describe("compose", () => {
  it("composes functions right-to-left", () => {
    const f = compose(
      (x: number) => x.toString(),
      (x: number) => x + 1,
      (x: number) => x * 2,
    );
    expect(f(5)).toBe("11");
  });
});

describe("utility functions", () => {
  it("identity returns its argument", () => {
    expect(identity(42)).toBe(42);
    expect(identity("hello")).toBe("hello");
  });

  it("constant always returns the same value", () => {
    const always42 = constant(42);
    expect(always42(1)).toBe(42);
    expect(always42("ignored")).toBe(42);
  });
});

// ============================================================================
// Typeclass Tests
// ============================================================================

describe("Semigroup", () => {
  it("combines strings", () => {
    expect(semigroupString.combine("hello", " world")).toBe("hello world");
  });

  it("combines numbers with sum", () => {
    expect(semigroupSum.combine(1, 2)).toBe(3);
  });

  it("combineAllMonoid reduces array", () => {
    expect(combineAllMonoid(monoidString)(["a", "b", "c"])).toBe("abc");
    expect(combineAllMonoid(monoidSum)([1, 2, 3, 4])).toBe(10);
  });

  it("combineAllMonoid returns empty for empty array", () => {
    expect(combineAllMonoid(monoidString)([])).toBe("");
    expect(combineAllMonoid(monoidSum)([])).toBe(0);
  });
});

describe("Eq", () => {
  it("eqNumber compares numbers", () => {
    expect(eqNumber.eqv(1, 1)).toBe(true);
    expect(eqNumber.eqv(1, 2)).toBe(false);
  });

  it("eqString compares strings", () => {
    expect(eqString.eqv("hello", "hello")).toBe(true);
    expect(eqString.eqv("hello", "world")).toBe(false);
  });
});

describe("Ord", () => {
  it("ordNumber compares numbers", () => {
    expect(ordNumber.compare(1, 2)).toBe(-1);
    expect(ordNumber.compare(2, 2)).toBe(0);
    expect(ordNumber.compare(3, 2)).toBe(1);
  });
});

describe("Show", () => {
  it("showNumber converts to string", () => {
    expect(showNumber.show(42)).toBe("42");
  });

  it("showString wraps in quotes", () => {
    expect(showString.show("hello")).toBe('"hello"');
  });
});
