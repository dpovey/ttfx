/**
 * Tests for the specialize macro and zero-cost HKT typeclass instances
 *
 * These tests verify:
 * 1. The specialization registry correctly stores instance methods
 * 2. Concrete typeclass instances work correctly through the HKT system
 * 3. Derived typeclass operations compose correctly
 * 4. The specialize macro's runtime fallback (partial application) works
 */

import { describe, it, expect } from "vitest";

// Specialization infrastructure
import {
  registerInstanceMethods,
  getInstanceMethods,
} from "../src/macros/specialize.js";

// Cats HKT types
import type { Kind } from "../src/use-cases/cats/hkt.js";
import type {
  OptionHKT,
  ArrayHKT,
  PromiseHKT,
  EitherHKT,
} from "../src/use-cases/cats/hkt.js";

// Typeclass interfaces
import type { Functor } from "../src/use-cases/cats/typeclasses/functor.js";
import type { Monad } from "../src/use-cases/cats/typeclasses/monad.js";
import type { Foldable } from "../src/use-cases/cats/typeclasses/foldable.js";

// Derived operations
import { as, lift, void_ } from "../src/use-cases/cats/typeclasses/functor.js";
import {
  map2,
  tuple2,
  when,
  replicateA,
} from "../src/use-cases/cats/typeclasses/applicative.js";
import {
  flatten,
  flatTap,
  sequence,
  traverse,
} from "../src/use-cases/cats/typeclasses/monad.js";
import {
  fold,
  foldMap,
  toArray,
  isEmpty,
  size,
  exists,
  find,
  head,
  last,
} from "../src/use-cases/cats/typeclasses/foldable.js";

// Concrete instances
import {
  optionFunctor,
  optionMonad,
  optionFoldable,
  optionTraverse,
  optionSemigroupK,
  optionMonoidK,
  optionAlternative,
  arrayFunctor,
  arrayMonad,
  arrayFoldable,
  arrayTraverse,
  arraySemigroupK,
  arrayMonoidK,
  arrayAlternative,
  promiseFunctor,
  promiseMonad,
  eitherFunctor,
  eitherMonad,
} from "../src/use-cases/cats/instances.js";

// Data types
import {
  Some,
  None,
  isSome,
  isNone,
} from "../src/use-cases/cats/data/option.js";
import type { Option } from "../src/use-cases/cats/data/option.js";
import {
  Left,
  Right,
  isLeft,
  isRight,
} from "../src/use-cases/cats/data/either.js";
import type { Either } from "../src/use-cases/cats/data/either.js";

// Semigroup/Monoid for fold tests
import {
  monoidSum,
  monoidString,
} from "../src/use-cases/cats/typeclasses/semigroup.js";

// ============================================================================
// Specialization Registry Tests
// ============================================================================

describe("Specialization Registry", () => {
  it("should register and retrieve instance methods", () => {
    const methods = getInstanceMethods("arrayFunctor");
    expect(methods).toBeDefined();
    expect(methods!.brand).toBe("Array");
    expect(methods!.methods.has("map")).toBe(true);
  });

  it("should register Option instance methods", () => {
    const methods = getInstanceMethods("optionMonad");
    expect(methods).toBeDefined();
    expect(methods!.brand).toBe("Option");
    expect(methods!.methods.has("map")).toBe(true);
    expect(methods!.methods.has("pure")).toBe(true);
    expect(methods!.methods.has("flatMap")).toBe(true);
    expect(methods!.methods.has("ap")).toBe(true);
  });

  it("should register Either instance methods", () => {
    const methods = getInstanceMethods("eitherMonad");
    expect(methods).toBeDefined();
    expect(methods!.brand).toBe("Either");
  });

  it("should register Promise instance methods", () => {
    const methods = getInstanceMethods("promiseMonad");
    expect(methods).toBeDefined();
    expect(methods!.brand).toBe("Promise");
  });

  it("should return undefined for unknown instances", () => {
    expect(getInstanceMethods("unknownInstance")).toBeUndefined();
  });
});

// ============================================================================
// Option Functor Tests
// ============================================================================

describe("Option Functor", () => {
  const F = optionFunctor;

  it("should map over Some", () => {
    const result = F.map(Some(42) as any, (x: number) => x * 2);
    expect(result).toEqual(Some(84));
  });

  it("should preserve None", () => {
    const result = F.map(None as any, (x: number) => x * 2);
    expect(result).toEqual(None);
  });

  it("should satisfy identity law", () => {
    const some = Some(42) as any;
    expect(F.map(some, (x: number) => x)).toEqual(Some(42));
    expect(F.map(None as any, (x: number) => x)).toEqual(None);
  });

  it("should satisfy composition law", () => {
    const some = Some(5) as any;
    const f = (x: number) => x * 2;
    const g = (x: number) => x + 1;

    const composed = F.map(F.map(some, f), g);
    const direct = F.map(some, (x: number) => g(f(x)));
    expect(composed).toEqual(direct);
  });
});

// ============================================================================
// Option Monad Tests
// ============================================================================

describe("Option Monad", () => {
  const M = optionMonad;

  it("should pure a value into Some", () => {
    expect(M.pure(42)).toEqual(Some(42));
  });

  it("should flatMap Some", () => {
    const result = M.flatMap(Some(42) as any, (x: number) =>
      x > 0 ? (Some(x * 2) as any) : (None as any),
    );
    expect(result).toEqual(Some(84));
  });

  it("should flatMap None", () => {
    const result = M.flatMap(None as any, (x: number) => Some(x * 2) as any);
    expect(result).toEqual(None);
  });

  it("should satisfy left identity", () => {
    const f = (x: number) => (x > 0 ? Some(x * 2) : None) as any;
    const result = M.flatMap(M.pure(42), f);
    expect(result).toEqual(f(42));
  });

  it("should satisfy right identity", () => {
    const some = Some(42) as any;
    const result = M.flatMap(some, (a: number) => M.pure(a));
    expect(result).toEqual(some);
  });

  it("should satisfy associativity", () => {
    const some = Some(5) as any;
    const f = (x: number) => (x > 0 ? Some(x * 2) : None) as any;
    const g = (x: number) => (x < 100 ? Some(x + 1) : None) as any;

    const left = M.flatMap(M.flatMap(some, f), g);
    const right = M.flatMap(some, (a: number) => M.flatMap(f(a), g));
    expect(left).toEqual(right);
  });
});

// ============================================================================
// Option Foldable Tests
// ============================================================================

describe("Option Foldable", () => {
  const F = optionFoldable;

  it("should foldLeft Some", () => {
    const result = F.foldLeft(
      Some(42) as any,
      0,
      (acc: number, a: number) => acc + a,
    );
    expect(result).toBe(42);
  });

  it("should foldLeft None", () => {
    const result = F.foldLeft(
      None as any,
      0,
      (acc: number, a: number) => acc + a,
    );
    expect(result).toBe(0);
  });

  it("should foldRight Some", () => {
    const result = F.foldRight(
      Some("hello") as any,
      "",
      (a: string, acc: string) => a + acc,
    );
    expect(result).toBe("hello");
  });

  it("should convert Some to array", () => {
    expect(toArray(F)(Some(42) as any)).toEqual([42]);
  });

  it("should convert None to empty array", () => {
    expect(toArray(F)(None as any)).toEqual([]);
  });

  it("should check isEmpty", () => {
    expect(isEmpty(F)(Some(42) as any)).toBe(false);
    expect(isEmpty(F)(None as any)).toBe(true);
  });

  it("should get size", () => {
    expect(size(F)(Some(42) as any)).toBe(1);
    expect(size(F)(None as any)).toBe(0);
  });

  it("should find in Some", () => {
    expect(find(F)(Some(42) as any, (x: number) => x > 0)).toBe(42);
    expect(find(F)(Some(42) as any, (x: number) => x > 100)).toBeUndefined();
  });

  it("should get head and last", () => {
    expect(head(F)(Some(42) as any)).toBe(42);
    expect(head(F)(None as any)).toBeUndefined();
    expect(last(F)(Some(42) as any)).toBe(42);
    expect(last(F)(None as any)).toBeUndefined();
  });
});

// ============================================================================
// Array Instances Tests (through HKT)
// ============================================================================

describe("Array Functor (HKT)", () => {
  const F = arrayFunctor;

  it("should map over arrays", () => {
    const result = F.map([1, 2, 3] as any, (x: number) => x * 2);
    expect(result).toEqual([2, 4, 6]);
  });

  it("should satisfy identity law", () => {
    const arr = [1, 2, 3] as any;
    expect(F.map(arr, (x: number) => x)).toEqual([1, 2, 3]);
  });
});

describe("Array Monad (HKT)", () => {
  const M = arrayMonad;

  it("should pure into singleton array", () => {
    expect(M.pure(42)).toEqual([42]);
  });

  it("should flatMap arrays", () => {
    const result = M.flatMap(
      [1, 2, 3] as any,
      (x: number) => [x, x * 10] as any,
    );
    expect(result).toEqual([1, 10, 2, 20, 3, 30]);
  });

  it("should satisfy monad laws", () => {
    const f = (x: number) => [x, x + 1] as any;

    // Left identity
    expect(M.flatMap(M.pure(5), f)).toEqual(f(5));

    // Right identity
    const arr = [1, 2] as any;
    expect(M.flatMap(arr, (a: number) => M.pure(a))).toEqual([1, 2]);
  });
});

describe("Array Foldable (HKT)", () => {
  const F = arrayFoldable;

  it("should foldLeft", () => {
    expect(
      F.foldLeft([1, 2, 3] as any, 0, (acc: number, a: number) => acc + a),
    ).toBe(6);
  });

  it("should fold with monoid", () => {
    expect(fold(F)([1, 2, 3, 4] as any, monoidSum)).toBe(10);
  });

  it("should foldMap", () => {
    expect(
      foldMap(F)([1, 2, 3] as any, (x: number) => String(x), monoidString),
    ).toBe("123");
  });

  it("should convert to array (identity for arrays)", () => {
    expect(toArray(F)([1, 2, 3] as any)).toEqual([1, 2, 3]);
  });

  it("should check exists", () => {
    expect(exists(F)([1, 2, 3] as any, (x: number) => x === 2)).toBe(true);
    expect(exists(F)([1, 2, 3] as any, (x: number) => x === 5)).toBe(false);
  });
});

// ============================================================================
// Either Instances Tests
// ============================================================================

describe("Either Functor (HKT)", () => {
  const F = eitherFunctor;

  it("should map over Right", () => {
    const result = F.map(Right(42) as any, (x: number) => x * 2);
    expect(result).toEqual(Right(84));
  });

  it("should preserve Left", () => {
    const result = F.map(Left("error") as any, (x: number) => x * 2);
    expect(result).toEqual(Left("error"));
  });
});

describe("Either Monad (HKT)", () => {
  const M = eitherMonad;

  it("should pure into Right", () => {
    expect(M.pure(42)).toEqual(Right(42));
  });

  it("should flatMap Right", () => {
    const result = M.flatMap(Right(42) as any, (x: number) =>
      x > 0 ? (Right(x * 2) as any) : (Left("negative") as any),
    );
    expect(result).toEqual(Right(84));
  });

  it("should short-circuit on Left", () => {
    const result = M.flatMap(
      Left("error") as any,
      (x: number) => Right(x * 2) as any,
    );
    expect(result).toEqual(Left("error"));
  });
});

// ============================================================================
// Promise Instances Tests
// ============================================================================

describe("Promise Functor (HKT)", () => {
  const F = promiseFunctor;

  it("should map over resolved promises", async () => {
    const result = F.map(
      Promise.resolve(42) as any,
      (x: number) => x * 2,
    ) as unknown as Promise<number>;
    expect(await result).toBe(84);
  });
});

describe("Promise Monad (HKT)", () => {
  const M = promiseMonad;

  it("should pure into resolved promise", async () => {
    const result = M.pure(42) as unknown as Promise<number>;
    expect(await result).toBe(42);
  });

  it("should flatMap promises", async () => {
    const result = M.flatMap(
      Promise.resolve(42) as any,
      (x: number) => Promise.resolve(x * 2) as any,
    ) as unknown as Promise<number>;
    expect(await result).toBe(84);
  });
});

// ============================================================================
// Derived Operations Tests (Generic over F)
// ============================================================================

describe("Derived Operations (generic)", () => {
  describe("Functor derived ops", () => {
    it("as should replace values in Option", () => {
      const asOp = as(optionFunctor as any);
      expect(asOp(Some(42) as any, "replaced")).toEqual(Some("replaced"));
      expect(asOp(None as any, "replaced")).toEqual(None);
    });

    it("as should replace values in Array", () => {
      const asOp = as(arrayFunctor as any);
      expect(asOp([1, 2, 3] as any, "x")).toEqual(["x", "x", "x"]);
    });

    it("lift should lift a function", () => {
      const liftedDouble = lift(arrayFunctor as any)((x: number) => x * 2);
      expect(liftedDouble([1, 2, 3] as any)).toEqual([2, 4, 6]);
    });
  });

  describe("Applicative derived ops", () => {
    it("map2 should combine two Options", () => {
      const map2Op = map2(optionMonad as any);
      expect(
        map2Op(Some(2) as any, Some(3) as any, (a: number, b: number) => a + b),
      ).toEqual(Some(5));
      expect(
        map2Op(Some(2) as any, None as any, (a: number, b: number) => a + b),
      ).toEqual(None);
    });

    it("map2 should combine two Arrays", () => {
      const map2Op = map2(arrayMonad as any);
      const result = map2Op(
        [1, 2] as any,
        [10, 20] as any,
        (a: number, b: number) => a + b,
      );
      expect(result).toEqual([11, 21, 12, 22]);
    });

    it("tuple2 should pair values", () => {
      const tuple2Op = tuple2(optionMonad as any);
      expect(tuple2Op(Some(1) as any, Some("a") as any)).toEqual(
        Some([1, "a"]),
      );
    });
  });

  describe("Monad derived ops", () => {
    it("flatten should flatten nested Options", () => {
      const flattenOp = flatten(optionMonad as any);
      expect(flattenOp(Some(Some(42)) as any)).toEqual(Some(42));
      expect(flattenOp(Some(None) as any)).toEqual(None);
      expect(flattenOp(None as any)).toEqual(None);
    });

    it("flatten should flatten nested Arrays", () => {
      const flattenOp = flatten(arrayMonad as any);
      expect(
        flattenOp([
          [1, 2],
          [3, 4],
        ] as any),
      ).toEqual([1, 2, 3, 4]);
    });

    it("sequence should sequence array of Options", () => {
      const seqOp = sequence(optionMonad as any);
      expect(seqOp([Some(1), Some(2), Some(3)] as any[])).toEqual(
        Some([1, 2, 3]),
      );
      expect(seqOp([Some(1), None, Some(3)] as any[])).toEqual(None);
    });

    it("traverse should map and sequence", () => {
      const travOp = traverse(optionMonad as any);
      expect(
        travOp([1, 2, 3], (x: number) => (x > 0 ? Some(x * 2) : None) as any),
      ).toEqual(Some([2, 4, 6]));
      expect(
        travOp([1, -1, 3], (x: number) => (x > 0 ? Some(x * 2) : None) as any),
      ).toEqual(None);
    });
  });
});

// ============================================================================
// SemigroupK / MonoidK / Alternative Tests
// ============================================================================

describe("Alternative instances", () => {
  it("Option SemigroupK should pick first Some", () => {
    expect(optionSemigroupK.combineK(Some(1) as any, Some(2) as any)).toEqual(
      Some(1),
    );
    expect(optionSemigroupK.combineK(None as any, Some(2) as any)).toEqual(
      Some(2),
    );
    expect(optionSemigroupK.combineK(None as any, None as any)).toEqual(None);
  });

  it("Option MonoidK should have None as empty", () => {
    expect(optionMonoidK.emptyK()).toEqual(None);
  });

  it("Array SemigroupK should concatenate", () => {
    expect(arraySemigroupK.combineK([1, 2] as any, [3, 4] as any)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it("Array MonoidK should have empty array as empty", () => {
    expect(arrayMonoidK.emptyK()).toEqual([]);
  });
});

// ============================================================================
// Generic Programming Tests — Same function, different types
// ============================================================================

describe("Generic programming via HKT", () => {
  /**
   * A generic function that works with any Monad.
   * With `specialize`, this becomes zero-cost at compile time.
   */
  function doubleAll<F>(M: Monad<F>, fa: Kind<F, number>): Kind<F, number> {
    return M.map(fa, (x) => x * 2);
  }

  it("should work with Option", () => {
    expect(doubleAll(optionMonad as any, Some(21) as any)).toEqual(Some(42));
    expect(doubleAll(optionMonad as any, None as any)).toEqual(None);
  });

  it("should work with Array", () => {
    expect(doubleAll(arrayMonad as any, [1, 2, 3] as any)).toEqual([2, 4, 6]);
  });

  it("should work with Promise", async () => {
    const result = doubleAll(
      promiseMonad as any,
      Promise.resolve(21) as any,
    ) as unknown as Promise<number>;
    expect(await result).toBe(42);
  });

  /**
   * A generic function using flatMap.
   */
  function safeDivide<F>(
    M: Monad<F>,
    fa: Kind<F, number>,
    fb: Kind<F, number>,
    onZero: Kind<F, number>,
  ): Kind<F, number> {
    return M.flatMap(fa, (a) =>
      M.flatMap(fb, (b) => (b === 0 ? onZero : M.pure(a / b))),
    );
  }

  it("safeDivide should work with Option", () => {
    expect(
      safeDivide(
        optionMonad as any,
        Some(10) as any,
        Some(2) as any,
        None as any,
      ),
    ).toEqual(Some(5));
    expect(
      safeDivide(
        optionMonad as any,
        Some(10) as any,
        Some(0) as any,
        None as any,
      ),
    ).toEqual(None);
    expect(
      safeDivide(optionMonad as any, None as any, Some(2) as any, None as any),
    ).toEqual(None);
  });

  it("safeDivide should work with Array", () => {
    expect(
      safeDivide(arrayMonad as any, [10, 20] as any, [2, 5] as any, [] as any),
    ).toEqual([5, 2, 10, 4]);
  });
});
