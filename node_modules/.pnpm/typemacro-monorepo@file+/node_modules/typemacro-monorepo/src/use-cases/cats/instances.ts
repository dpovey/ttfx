/**
 * Typeclass Instances for Cats Data Types
 *
 * This module provides concrete typeclass instances (Functor, Monad, Foldable,
 * Traverse, etc.) for all Cats data types, wired through the unified HKT system.
 *
 * All instances are registered with the specialization system, enabling the
 * `specialize` macro to inline them at compile time for zero-cost abstractions.
 *
 * ## Usage
 *
 * ```typescript
 * import { optionMonad, arrayMonad } from "./instances.js";
 * import { specialize } from "../../macros/specialize.js";
 *
 * // Generic function
 * function double<F>(F: Monad<F>, fa: Kind<F, number>): Kind<F, number> {
 *   return F.map(fa, x => x * 2);
 * }
 *
 * // Zero-cost specialized version (macro eliminates dictionary at compile time)
 * const doubleOption = specialize(double, optionMonad);
 * // Compiles to: (fa) => fa._tag === "Some" ? Some(fa.value * 2) : None
 * ```
 */

import type { Kind, Kind2 } from "./hkt.js";
import type {
  OptionHKT,
  EitherHKT,
  ListHKT,
  ArrayHKT,
  PromiseHKT,
} from "./hkt.js";
import type { Functor, Functor2 } from "./typeclasses/functor.js";
import type { Applicative } from "./typeclasses/applicative.js";
import type { Monad, Monad2 } from "./typeclasses/monad.js";
import { makeMonad, makeMonad2 } from "./typeclasses/monad.js";
import type { Foldable } from "./typeclasses/foldable.js";
import type { Traverse } from "./typeclasses/traverse.js";
import type { MonadError } from "./typeclasses/monad-error.js";
import type {
  SemigroupK,
  MonoidK,
  Alternative,
} from "./typeclasses/alternative.js";

import type { Option } from "./data/option.js";
import { Some, None, isSome, isNone } from "./data/option.js";
import type { Either } from "./data/either.js";
import { Left, Right, isLeft, isRight } from "./data/either.js";

import { registerInstanceMethods } from "../../macros/specialize.js";

// ============================================================================
// Option Instances
// ============================================================================

/**
 * Functor instance for Option
 */
export const optionFunctor: Functor<OptionHKT> = {
  URI: {} as OptionHKT,
  map: <A, B>(fa: Kind<OptionHKT, A>, f: (a: A) => B): Kind<OptionHKT, B> => {
    const opt = fa as unknown as Option<A>;
    return (isSome(opt) ? Some(f(opt.value)) : None) as unknown as Kind<
      OptionHKT,
      B
    >;
  },
};

/**
 * Monad instance for Option
 */
export const optionMonad: Monad<OptionHKT> = makeMonad<OptionHKT>(
  {} as OptionHKT,
  <A>(a: A): Kind<OptionHKT, A> => Some(a) as unknown as Kind<OptionHKT, A>,
  <A, B>(
    fa: Kind<OptionHKT, A>,
    f: (a: A) => Kind<OptionHKT, B>,
  ): Kind<OptionHKT, B> => {
    const opt = fa as unknown as Option<A>;
    return (isSome(opt) ? f(opt.value) : None) as unknown as Kind<OptionHKT, B>;
  },
);

/**
 * Foldable instance for Option
 */
export const optionFoldable: Foldable<OptionHKT> = {
  URI: {} as OptionHKT,
  foldLeft: <A, B>(fa: Kind<OptionHKT, A>, b: B, f: (b: B, a: A) => B): B => {
    const opt = fa as unknown as Option<A>;
    return isSome(opt) ? f(b, opt.value) : b;
  },
  foldRight: <A, B>(fa: Kind<OptionHKT, A>, b: B, f: (a: A, b: B) => B): B => {
    const opt = fa as unknown as Option<A>;
    return isSome(opt) ? f(opt.value, b) : b;
  },
};

/**
 * Traverse instance for Option
 */
export const optionTraverse: Traverse<OptionHKT> = {
  ...optionFunctor,
  ...optionFoldable,
  traverse: <G, A, B>(
    G: Applicative<G>,
    ta: Kind<OptionHKT, A>,
    f: (a: A) => Kind<G, B>,
  ): Kind<G, Kind<OptionHKT, B>> => {
    const opt = ta as unknown as Option<A>;
    if (isSome(opt)) {
      return G.map(
        f(opt.value),
        (b) => Some(b) as unknown as Kind<OptionHKT, B>,
      );
    }
    return G.pure(None as unknown as Kind<OptionHKT, B>);
  },
};

/**
 * SemigroupK instance for Option (first Some wins)
 */
export const optionSemigroupK: SemigroupK<OptionHKT> = {
  URI: {} as OptionHKT,
  combineK: <A>(
    x: Kind<OptionHKT, A>,
    y: Kind<OptionHKT, A>,
  ): Kind<OptionHKT, A> => {
    const optX = x as unknown as Option<A>;
    return isSome(optX) ? x : y;
  },
};

/**
 * MonoidK instance for Option
 */
export const optionMonoidK: MonoidK<OptionHKT> = {
  ...optionSemigroupK,
  emptyK: <A>(): Kind<OptionHKT, A> => None as unknown as Kind<OptionHKT, A>,
};

/**
 * Alternative instance for Option
 */
export const optionAlternative: Alternative<OptionHKT> = {
  ...optionMonad,
  ...optionMonoidK,
};

// ============================================================================
// Array Instances (re-exported from base, registered for specialization)
// ============================================================================

/**
 * Functor instance for Array
 */
export const arrayFunctor: Functor<ArrayHKT> = {
  URI: {} as ArrayHKT,
  map: <A, B>(fa: Kind<ArrayHKT, A>, f: (a: A) => B): Kind<ArrayHKT, B> =>
    (fa as unknown as A[]).map(f) as unknown as Kind<ArrayHKT, B>,
};

/**
 * Monad instance for Array
 */
export const arrayMonad: Monad<ArrayHKT> = makeMonad<ArrayHKT>(
  {} as ArrayHKT,
  <A>(a: A): Kind<ArrayHKT, A> => [a] as unknown as Kind<ArrayHKT, A>,
  <A, B>(
    fa: Kind<ArrayHKT, A>,
    f: (a: A) => Kind<ArrayHKT, B>,
  ): Kind<ArrayHKT, B> =>
    (fa as unknown as A[]).flatMap(
      (a) => f(a) as unknown as B[],
    ) as unknown as Kind<ArrayHKT, B>,
);

/**
 * Foldable instance for Array
 */
export const arrayFoldable: Foldable<ArrayHKT> = {
  URI: {} as ArrayHKT,
  foldLeft: <A, B>(fa: Kind<ArrayHKT, A>, b: B, f: (b: B, a: A) => B): B =>
    (fa as unknown as A[]).reduce(f, b),
  foldRight: <A, B>(fa: Kind<ArrayHKT, A>, b: B, f: (a: A, b: B) => B): B =>
    (fa as unknown as A[]).reduceRight((acc, a) => f(a, acc), b),
};

/**
 * Traverse instance for Array
 */
export const arrayTraverse: Traverse<ArrayHKT> = {
  ...arrayFunctor,
  ...arrayFoldable,
  traverse: <G, A, B>(
    G: Applicative<G>,
    ta: Kind<ArrayHKT, A>,
    f: (a: A) => Kind<G, B>,
  ): Kind<G, Kind<ArrayHKT, B>> => {
    const arr = ta as unknown as A[];
    return arr.reduce(
      (acc: Kind<G, Kind<ArrayHKT, B>>, a: A) =>
        G.ap(
          G.map(
            acc,
            (bs) => (b: B) =>
              [...(bs as unknown as B[]), b] as unknown as Kind<ArrayHKT, B>,
          ),
          f(a),
        ),
      G.pure([] as unknown as Kind<ArrayHKT, B>),
    );
  },
};

/**
 * SemigroupK instance for Array
 */
export const arraySemigroupK: SemigroupK<ArrayHKT> = {
  URI: {} as ArrayHKT,
  combineK: <A>(
    x: Kind<ArrayHKT, A>,
    y: Kind<ArrayHKT, A>,
  ): Kind<ArrayHKT, A> =>
    [...(x as unknown as A[]), ...(y as unknown as A[])] as unknown as Kind<
      ArrayHKT,
      A
    >,
};

/**
 * MonoidK instance for Array
 */
export const arrayMonoidK: MonoidK<ArrayHKT> = {
  ...arraySemigroupK,
  emptyK: <A>(): Kind<ArrayHKT, A> => [] as unknown as Kind<ArrayHKT, A>,
};

/**
 * Alternative instance for Array
 */
export const arrayAlternative: Alternative<ArrayHKT> = {
  ...arrayMonad,
  ...arrayMonoidK,
};

// ============================================================================
// Promise Instances
// ============================================================================

/**
 * Functor instance for Promise
 */
export const promiseFunctor: Functor<PromiseHKT> = {
  URI: {} as PromiseHKT,
  map: <A, B>(fa: Kind<PromiseHKT, A>, f: (a: A) => B): Kind<PromiseHKT, B> =>
    (fa as unknown as Promise<A>).then(f) as unknown as Kind<PromiseHKT, B>,
};

/**
 * Monad instance for Promise
 */
export const promiseMonad: Monad<PromiseHKT> = makeMonad<PromiseHKT>(
  {} as PromiseHKT,
  <A>(a: A): Kind<PromiseHKT, A> =>
    Promise.resolve(a) as unknown as Kind<PromiseHKT, A>,
  <A, B>(
    fa: Kind<PromiseHKT, A>,
    f: (a: A) => Kind<PromiseHKT, B>,
  ): Kind<PromiseHKT, B> =>
    (fa as unknown as Promise<A>).then(
      (a) => f(a) as unknown as Promise<B>,
    ) as unknown as Kind<PromiseHKT, B>,
);

// ============================================================================
// Either Instances
// ============================================================================

/**
 * Functor instance for Either (maps over the Right value)
 */
export const eitherFunctor: Functor2<EitherHKT> = {
  URI: {} as EitherHKT,
  map: <E, A, B>(
    fa: Kind2<EitherHKT, E, A>,
    f: (a: A) => B,
  ): Kind2<EitherHKT, E, B> => {
    const either = fa as unknown as Either<E, A>;
    return (isRight(either)
      ? Right(f(either.right))
      : either) as unknown as Kind2<EitherHKT, E, B>;
  },
};

/**
 * Monad instance for Either
 */
export const eitherMonad: Monad2<EitherHKT> = makeMonad2<EitherHKT>(
  {} as EitherHKT,
  <E, A>(a: A): Kind2<EitherHKT, E, A> =>
    Right(a) as unknown as Kind2<EitherHKT, E, A>,
  <E, A, B>(
    fa: Kind2<EitherHKT, E, A>,
    f: (a: A) => Kind2<EitherHKT, E, B>,
  ): Kind2<EitherHKT, E, B> => {
    const either = fa as unknown as Either<E, A>;
    return (isRight(either) ? f(either.right) : either) as unknown as Kind2<
      EitherHKT,
      E,
      B
    >;
  },
);

// ============================================================================
// Register instances with specialization system
// ============================================================================

registerInstanceMethods("optionFunctor", "Option", {
  map: {
    source:
      '(fa, f) => fa._tag === "Some" ? { _tag: "Some", value: f(fa.value) } : fa',
    params: ["fa", "f"],
  },
});

registerInstanceMethods("optionMonad", "Option", {
  map: {
    source:
      '(fa, f) => fa._tag === "Some" ? { _tag: "Some", value: f(fa.value) } : fa',
    params: ["fa", "f"],
  },
  pure: {
    source: '(a) => ({ _tag: "Some", value: a })',
    params: ["a"],
  },
  flatMap: {
    source: '(fa, f) => fa._tag === "Some" ? f(fa.value) : fa',
    params: ["fa", "f"],
  },
  ap: {
    source:
      '(fab, fa) => fab._tag === "Some" && fa._tag === "Some" ? { _tag: "Some", value: fab.value(fa.value) } : { _tag: "None" }',
    params: ["fab", "fa"],
  },
});

registerInstanceMethods("optionFoldable", "Option", {
  foldLeft: {
    source: '(fa, b, f) => fa._tag === "Some" ? f(b, fa.value) : b',
    params: ["fa", "b", "f"],
  },
  foldRight: {
    source: '(fa, b, f) => fa._tag === "Some" ? f(fa.value, b) : b',
    params: ["fa", "b", "f"],
  },
});

registerInstanceMethods("eitherFunctor", "Either", {
  map: {
    source:
      '(fa, f) => fa._tag === "Right" ? { _tag: "Right", right: f(fa.right) } : fa',
    params: ["fa", "f"],
  },
});

registerInstanceMethods("eitherMonad", "Either", {
  map: {
    source:
      '(fa, f) => fa._tag === "Right" ? { _tag: "Right", right: f(fa.right) } : fa',
    params: ["fa", "f"],
  },
  pure: {
    source: '(a) => ({ _tag: "Right", right: a })',
    params: ["a"],
  },
  flatMap: {
    source: '(fa, f) => fa._tag === "Right" ? f(fa.right) : fa',
    params: ["fa", "f"],
  },
  ap: {
    source:
      '(fab, fa) => fab._tag === "Right" && fa._tag === "Right" ? { _tag: "Right", right: fab.right(fa.right) } : fab._tag === "Left" ? fab : fa',
    params: ["fab", "fa"],
  },
});
