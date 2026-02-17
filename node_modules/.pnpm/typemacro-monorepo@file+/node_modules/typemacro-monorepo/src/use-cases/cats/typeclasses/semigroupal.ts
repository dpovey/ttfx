/**
 * Semigroupal Typeclass
 *
 * A type class that allows combining two contexts into a tuple.
 * This is weaker than Apply - it only requires product, not ap.
 *
 * Laws:
 *   - Associativity: product(product(fa, fb), fc) ~ product(fa, product(fb, fc))
 *     (isomorphic via reassociation of tuples)
 */

import type { Functor } from "./functor.js";
import type { Kind, Kind2 } from "../hkt.js";

// ============================================================================
// Semigroupal
// ============================================================================

/**
 * Semigroupal typeclass - product of two contexts
 */
export interface Semigroupal<F> extends Functor<F> {
  readonly product: <A, B>(fa: Kind<F, A>, fb: Kind<F, B>) => Kind<F, [A, B]>;
}

/**
 * Semigroupal for 2-arity type constructors
 */
export interface Semigroupal2<F> {
  readonly URI: F;
  readonly product: <E, A, B>(
    fa: Kind2<F, E, A>,
    fb: Kind2<F, E, B>,
  ) => Kind2<F, E, [A, B]>;
}

// ============================================================================
// Derived Operations
// ============================================================================

/**
 * Product of three values
 */
export function product3<F>(
  F: Semigroupal<F>,
): <A, B, C>(
  fa: Kind<F, A>,
  fb: Kind<F, B>,
  fc: Kind<F, C>,
) => Kind<F, [A, B, C]> {
  return (fa, fb, fc) =>
    F.map(F.product(F.product(fa, fb), fc), ([[a, b], c]) => [a, b, c]);
}

/**
 * Product of four values
 */
export function product4<F>(
  F: Semigroupal<F>,
): <A, B, C, D>(
  fa: Kind<F, A>,
  fb: Kind<F, B>,
  fc: Kind<F, C>,
  fd: Kind<F, D>,
) => Kind<F, [A, B, C, D]> {
  return (fa, fb, fc, fd) =>
    F.map(
      F.product(F.product(F.product(fa, fb), fc), fd),
      ([[[a, b], c], d]) => [a, b, c, d],
    );
}

/**
 * Product of five values
 */
export function product5<F>(
  F: Semigroupal<F>,
): <A, B, C, D, E>(
  fa: Kind<F, A>,
  fb: Kind<F, B>,
  fc: Kind<F, C>,
  fd: Kind<F, D>,
  fe: Kind<F, E>,
) => Kind<F, [A, B, C, D, E]> {
  return (fa, fb, fc, fd, fe) =>
    F.map(
      F.product(F.product(F.product(F.product(fa, fb), fc), fd), fe),
      ([[[[a, b], c], d], e]) => [a, b, c, d, e],
    );
}

/**
 * Map over a product - similar to map2 but with explicit product
 */
export function mapN<F>(
  F: Semigroupal<F>,
): <A, B, C>(
  fa: Kind<F, A>,
  fb: Kind<F, B>,
  f: (a: A, b: B) => C,
) => Kind<F, C> {
  return (fa, fb, f) => F.map(F.product(fa, fb), ([a, b]) => f(a, b));
}

/**
 * Map over three values
 */
export function mapN3<F>(
  F: Semigroupal<F>,
): <A, B, C, D>(
  fa: Kind<F, A>,
  fb: Kind<F, B>,
  fc: Kind<F, C>,
  f: (a: A, b: B, c: C) => D,
) => Kind<F, D> {
  return (fa, fb, fc, f) =>
    F.map(product3(F)(fa, fb, fc), ([a, b, c]) => f(a, b, c));
}

/**
 * Map over four values
 */
export function mapN4<F>(
  F: Semigroupal<F>,
): <A, B, C, D, E>(
  fa: Kind<F, A>,
  fb: Kind<F, B>,
  fc: Kind<F, C>,
  fd: Kind<F, D>,
  f: (a: A, b: B, c: C, d: D) => E,
) => Kind<F, E> {
  return (fa, fb, fc, fd, f) =>
    F.map(product4(F)(fa, fb, fc, fd), ([a, b, c, d]) => f(a, b, c, d));
}

/**
 * Map over five values
 */
export function mapN5<F>(
  F: Semigroupal<F>,
): <A, B, C, D, E, FF>(
  fa: Kind<F, A>,
  fb: Kind<F, B>,
  fc: Kind<F, C>,
  fd: Kind<F, D>,
  fe: Kind<F, E>,
  f: (a: A, b: B, c: C, d: D, e: E) => FF,
) => Kind<F, FF> {
  return (fa, fb, fc, fd, fe, f) =>
    F.map(product5(F)(fa, fb, fc, fd, fe), ([a, b, c, d, e]) =>
      f(a, b, c, d, e),
    );
}

/**
 * Sequence two actions, keeping the left value
 */
export function productL<F>(
  F: Semigroupal<F>,
): <A, B>(fa: Kind<F, A>, fb: Kind<F, B>) => Kind<F, A> {
  return (fa, fb) => F.map(F.product(fa, fb), ([a, _]) => a);
}

/**
 * Sequence two actions, keeping the right value
 */
export function productR<F>(
  F: Semigroupal<F>,
): <A, B>(fa: Kind<F, A>, fb: Kind<F, B>) => Kind<F, B> {
  return (fa, fb) => F.map(F.product(fa, fb), ([_, b]) => b);
}

// ============================================================================
// Instance Creator
// ============================================================================

/**
 * Create a Semigroupal instance
 */
export function makeSemigroupal<F>(
  functor: Functor<F>,
  product: <A, B>(fa: Kind<F, A>, fb: Kind<F, B>) => Kind<F, [A, B]>,
): Semigroupal<F> {
  return {
    ...functor,
    product,
  };
}

// ============================================================================
// Derive Apply from Semigroupal
// ============================================================================

/**
 * Derive ap from product (for types with both Semigroupal and Functor)
 */
export function apFromSemigroupal<F>(
  F: Semigroupal<F>,
): <A, B>(fab: Kind<F, (a: A) => B>, fa: Kind<F, A>) => Kind<F, B> {
  return (fab, fa) => F.map(F.product(fab, fa), ([f, a]) => f(a));
}
