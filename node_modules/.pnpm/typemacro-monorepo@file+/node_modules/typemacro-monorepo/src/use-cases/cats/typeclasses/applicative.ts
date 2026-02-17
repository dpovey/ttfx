/**
 * Apply and Applicative Typeclasses
 *
 * Apply extends Functor with the ability to apply a function in a context.
 * Applicative extends Apply with the ability to lift a value into a context.
 *
 * Laws:
 *   - Identity: pure(id).ap(v) === v
 *   - Homomorphism: pure(f).ap(pure(x)) === pure(f(x))
 *   - Interchange: u.ap(pure(y)) === pure(f => f(y)).ap(u)
 *   - Composition: pure(compose).ap(u).ap(v).ap(w) === u.ap(v.ap(w))
 */

import type { Functor, Functor2 } from "./functor.js";
import type { Kind, Kind2 } from "../hkt.js";

// ============================================================================
// Apply
// ============================================================================

/**
 * Apply typeclass - extends Functor with application
 */
export interface Apply<F> extends Functor<F> {
  readonly ap: <A, B>(fab: Kind<F, (a: A) => B>, fa: Kind<F, A>) => Kind<F, B>;
}

/**
 * Apply for 2-arity type constructors
 */
export interface Apply2<F> extends Functor2<F> {
  readonly ap: <E, A, B>(
    fab: Kind2<F, E, (a: A) => B>,
    fa: Kind2<F, E, A>,
  ) => Kind2<F, E, B>;
}

// ============================================================================
// Applicative
// ============================================================================

/**
 * Applicative typeclass - extends Apply with pure
 */
export interface Applicative<F> extends Apply<F> {
  readonly pure: <A>(a: A) => Kind<F, A>;
}

/**
 * Applicative for 2-arity type constructors
 */
export interface Applicative2<F> extends Apply2<F> {
  readonly pure: <E, A>(a: A) => Kind2<F, E, A>;
}

// ============================================================================
// Derived Operations from Apply
// ============================================================================

/**
 * Apply two functorial values and combine with a function
 */
export function map2<F>(
  F: Apply<F>,
): <A, B, C>(
  fa: Kind<F, A>,
  fb: Kind<F, B>,
  f: (a: A, b: B) => C,
) => Kind<F, C> {
  return (fa, fb, f) =>
    F.ap(
      F.map(fa, (a) => (b: B) => f(a, b)),
      fb,
    );
}

/**
 * Apply three functorial values and combine with a function
 */
export function map3<F>(
  F: Apply<F>,
): <A, B, C, D>(
  fa: Kind<F, A>,
  fb: Kind<F, B>,
  fc: Kind<F, C>,
  f: (a: A, b: B, c: C) => D,
) => Kind<F, D> {
  return (fa, fb, fc, f) => {
    const partialF = map2(F)(fa, fb, (a, b) => (c: C) => f(a, b, c));
    return F.ap(partialF, fc);
  };
}

/**
 * Apply four functorial values and combine with a function
 */
export function map4<F>(
  F: Apply<F>,
): <A, B, C, D, E>(
  fa: Kind<F, A>,
  fb: Kind<F, B>,
  fc: Kind<F, C>,
  fd: Kind<F, D>,
  f: (a: A, b: B, c: C, d: D) => E,
) => Kind<F, E> {
  return (fa, fb, fc, fd, f) => {
    const partialF = map3(F)(fa, fb, fc, (a, b, c) => (d: D) => f(a, b, c, d));
    return F.ap(partialF, fd);
  };
}

/**
 * Tuple two functorial values
 */
export function tuple2<F>(
  F: Apply<F>,
): <A, B>(fa: Kind<F, A>, fb: Kind<F, B>) => Kind<F, [A, B]> {
  return (fa, fb) => map2(F)(fa, fb, (a, b) => [a, b]);
}

/**
 * Tuple three functorial values
 */
export function tuple3<F>(
  F: Apply<F>,
): <A, B, C>(
  fa: Kind<F, A>,
  fb: Kind<F, B>,
  fc: Kind<F, C>,
) => Kind<F, [A, B, C]> {
  return (fa, fb, fc) => map3(F)(fa, fb, fc, (a, b, c) => [a, b, c]);
}

/**
 * Sequence two actions, keeping only the left value
 */
export function productL<F>(
  F: Apply<F>,
): <A, B>(fa: Kind<F, A>, fb: Kind<F, B>) => Kind<F, A> {
  return (fa, fb) => map2(F)(fa, fb, (a, _) => a);
}

/**
 * Sequence two actions, keeping only the right value
 */
export function productR<F>(
  F: Apply<F>,
): <A, B>(fa: Kind<F, A>, fb: Kind<F, B>) => Kind<F, B> {
  return (fa, fb) => map2(F)(fa, fb, (_, b) => b);
}

// ============================================================================
// Derived Operations from Applicative
// ============================================================================

/**
 * Lift a value into the applicative context
 */
export function unit<F>(F: Applicative<F>): Kind<F, void> {
  return F.pure(undefined);
}

/**
 * Perform an action when a condition is true
 */
export function when<F>(
  F: Applicative<F>,
): (condition: boolean, action: Kind<F, void>) => Kind<F, void> {
  return (condition, action) => (condition ? action : unit(F));
}

/**
 * Perform an action unless a condition is true
 */
export function unless<F>(
  F: Applicative<F>,
): (condition: boolean, action: Kind<F, void>) => Kind<F, void> {
  return (condition, action) => when(F)(!condition, action);
}

/**
 * Replicate an action n times and collect results
 */
export function replicateA<F>(
  F: Applicative<F>,
): <A>(n: number, fa: Kind<F, A>) => Kind<F, A[]> {
  return (n, fa) => {
    if (n <= 0) return F.pure([]);
    const result: Kind<F, A[]> = F.map(fa, (a) => [a]);
    let acc = result;
    for (let i = 1; i < n; i++) {
      acc = map2(F)(acc, fa, (arr, a) => [...arr, a]);
    }
    return acc;
  };
}

// ============================================================================
// Instance Creators
// ============================================================================

/**
 * Create an Apply instance
 */
export function makeApply<F>(
  URI: F,
  map: <A, B>(fa: Kind<F, A>, f: (a: A) => B) => Kind<F, B>,
  ap: <A, B>(fab: Kind<F, (a: A) => B>, fa: Kind<F, A>) => Kind<F, B>,
): Apply<F> {
  return { URI, map, ap };
}

/**
 * Create an Applicative instance
 */
export function makeApplicative<F>(
  URI: F,
  map: <A, B>(fa: Kind<F, A>, f: (a: A) => B) => Kind<F, B>,
  ap: <A, B>(fab: Kind<F, (a: A) => B>, fa: Kind<F, A>) => Kind<F, B>,
  pure: <A>(a: A) => Kind<F, A>,
): Applicative<F> {
  return { URI, map, ap, pure };
}
