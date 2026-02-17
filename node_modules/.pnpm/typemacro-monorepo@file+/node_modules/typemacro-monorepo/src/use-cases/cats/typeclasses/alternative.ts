/**
 * SemigroupK, MonoidK, and Alternative Typeclasses
 *
 * These are "higher-kinded" versions of Semigroup and Monoid that work
 * at the type constructor level rather than the type level.
 *
 * SemigroupK: A semigroup for type constructors
 * MonoidK: A monoid for type constructors
 * Alternative: Combines Applicative and MonoidK
 *
 * Laws:
 *   - SemigroupK Associativity: combineK(combineK(x, y), z) === combineK(x, combineK(y, z))
 *   - MonoidK Left Identity: combineK(empty(), x) === x
 *   - MonoidK Right Identity: combineK(x, empty()) === x
 */

import type { Applicative } from "./applicative.js";
import type { Kind, Kind2 } from "../hkt.js";

// ============================================================================
// SemigroupK
// ============================================================================

/**
 * SemigroupK typeclass - semigroup at the Kind level
 */
export interface SemigroupK<F> {
  readonly URI: F;
  readonly combineK: <A>(x: Kind<F, A>, y: Kind<F, A>) => Kind<F, A>;
}

/**
 * SemigroupK for 2-arity type constructors
 */
export interface SemigroupK2<F> {
  readonly URI: F;
  readonly combineK: <E, A>(
    x: Kind2<F, E, A>,
    y: Kind2<F, E, A>,
  ) => Kind2<F, E, A>;
}

// ============================================================================
// MonoidK
// ============================================================================

/**
 * MonoidK typeclass - monoid at the Kind level
 */
export interface MonoidK<F> extends SemigroupK<F> {
  readonly emptyK: <A>() => Kind<F, A>;
}

/**
 * MonoidK for 2-arity type constructors
 */
export interface MonoidK2<F> extends SemigroupK2<F> {
  readonly emptyK: <E, A>() => Kind2<F, E, A>;
}

// ============================================================================
// Alternative
// ============================================================================

/**
 * Alternative typeclass - combines Applicative and MonoidK
 */
export interface Alternative<F> extends Applicative<F>, MonoidK<F> {}

// ============================================================================
// Derived Operations from SemigroupK
// ============================================================================

/**
 * Combine multiple values
 */
export function combineAllK<F>(
  F: SemigroupK<F>,
): <A>(fas: Kind<F, A>[]) => Kind<F, A> | undefined {
  return (fas) => {
    if (fas.length === 0) return undefined;
    return fas.reduce((acc, fa) => F.combineK(acc, fa));
  };
}

/**
 * Try the first, if it's "empty" try the second
 */
export function orElse<F>(
  F: SemigroupK<F>,
): <A>(fa: Kind<F, A>, fb: () => Kind<F, A>) => Kind<F, A> {
  return (fa, fb) => F.combineK(fa, fb());
}

// ============================================================================
// Derived Operations from MonoidK
// ============================================================================

/**
 * Combine all values (returns empty for empty list)
 */
export function combineAllKMonoid<F>(
  F: MonoidK<F>,
): <A>(fas: Kind<F, A>[]) => Kind<F, A> {
  return (fas) => {
    if (fas.length === 0) return F.emptyK();
    return fas.reduce((acc, fa) => F.combineK(acc, fa));
  };
}

// ============================================================================
// Derived Operations from Alternative
// ============================================================================

/**
 * Try many alternatives, taking the first success
 */
export function oneOf<F>(
  F: Alternative<F>,
): <A>(fas: Kind<F, A>[]) => Kind<F, A> {
  return combineAllKMonoid(F);
}

/**
 * Conditional alternative
 */
export function guard<F>(
  F: Alternative<F>,
): (condition: boolean) => Kind<F, void> {
  return (condition) => (condition ? F.pure(undefined) : F.emptyK());
}

/**
 * Filter in Alternative
 */
export function afilter<F>(
  F: Alternative<F>,
): <A>(fa: Kind<F, A>, p: (a: A) => boolean) => Kind<F, A> {
  return (fa, p) =>
    (
      F as unknown as {
        flatMap: <A, B>(fa: Kind<F, A>, f: (a: A) => Kind<F, B>) => Kind<F, B>;
      }
    ).flatMap
      ? (
          F as unknown as {
            flatMap: <A, B>(
              fa: Kind<F, A>,
              f: (a: A) => Kind<F, B>,
            ) => Kind<F, B>;
          }
        ).flatMap(fa, (a) => (p(a) ? F.pure(a) : F.emptyK()))
      : fa;
}

/**
 * Some - one or more occurrences
 */
export function some<F>(
  F: Alternative<F>,
): <A>(fa: Kind<F, A>) => Kind<F, A[]> {
  return (fa) => {
    const manyResult: () => Kind<F, A[]> = () =>
      F.combineK(someResult(), F.pure([]));
    const someResult: () => Kind<F, A[]> = () =>
      F.ap(
        F.map(fa, (a) => (as: A[]) => [a, ...as]),
        manyResult(),
      );
    return someResult();
  };
}

/**
 * Many - zero or more occurrences
 */
export function many<F>(
  F: Alternative<F>,
): <A>(fa: Kind<F, A>) => Kind<F, A[]> {
  return (fa) => F.combineK(some(F)(fa), F.pure([]));
}

/**
 * Optional - zero or one occurrence
 */
export function optional<F>(
  F: Alternative<F>,
): <A>(fa: Kind<F, A>) => Kind<F, A | undefined> {
  return (fa) =>
    F.combineK(
      F.map(fa, (a) => a as A | undefined),
      F.pure(undefined as A | undefined),
    );
}

/**
 * Return the first success
 */
export function firstSome<F>(
  F: Alternative<F>,
): <A>(fa: Kind<F, A>, fb: Kind<F, A>) => Kind<F, A> {
  return (fa, fb) => F.combineK(fa, fb);
}

// ============================================================================
// Instance Creators
// ============================================================================

/**
 * Create a SemigroupK instance
 */
export function makeSemigroupK<F>(
  URI: F,
  combineK: <A>(x: Kind<F, A>, y: Kind<F, A>) => Kind<F, A>,
): SemigroupK<F> {
  return { URI, combineK };
}

/**
 * Create a MonoidK instance
 */
export function makeMonoidK<F>(
  URI: F,
  combineK: <A>(x: Kind<F, A>, y: Kind<F, A>) => Kind<F, A>,
  emptyK: <A>() => Kind<F, A>,
): MonoidK<F> {
  return { URI, combineK, emptyK };
}

/**
 * Create an Alternative instance
 */
export function makeAlternative<F>(
  applicative: Applicative<F>,
  monoidK: MonoidK<F>,
): Alternative<F> {
  return {
    ...applicative,
    ...monoidK,
  };
}

/**
 * Plus is another name for MonoidK
 */
export type Plus<F> = MonoidK<F>;
