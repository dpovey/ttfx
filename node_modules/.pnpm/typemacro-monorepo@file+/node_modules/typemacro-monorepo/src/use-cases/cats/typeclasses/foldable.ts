/**
 * Foldable Typeclass
 *
 * A type class for data structures that can be folded to a summary value.
 * All derived operations use dictionary-passing style and are compatible
 * with the `specialize` macro for zero-cost inlining.
 */

import type { Kind, Kind2 } from "../hkt.js";
import type { Monoid } from "./semigroup.js";

// ============================================================================
// Foldable
// ============================================================================

/**
 * Foldable typeclass
 */
export interface Foldable<F> {
  readonly URI: F;
  readonly foldLeft: <A, B>(fa: Kind<F, A>, b: B, f: (b: B, a: A) => B) => B;
  readonly foldRight: <A, B>(fa: Kind<F, A>, b: B, f: (a: A, b: B) => B) => B;
}

/**
 * Foldable for 2-arity type constructors
 */
export interface Foldable2<F> {
  readonly URI: F;
  readonly foldLeft: <E, A, B>(
    fa: Kind2<F, E, A>,
    b: B,
    f: (b: B, a: A) => B,
  ) => B;
  readonly foldRight: <E, A, B>(
    fa: Kind2<F, E, A>,
    b: B,
    f: (a: A, b: B) => B,
  ) => B;
}

// ============================================================================
// Derived Operations
// ============================================================================

/**
 * Fold using a Monoid
 */
export function fold<F>(
  F: Foldable<F>,
): <A>(fa: Kind<F, A>, M: Monoid<A>) => A {
  return (fa, M) => F.foldLeft(fa, M.empty, M.combine);
}

/**
 * Map each element to a monoid and combine
 */
export function foldMap<F>(
  F: Foldable<F>,
): <A, B>(fa: Kind<F, A>, f: (a: A) => B, M: Monoid<B>) => B {
  return (fa, f, M) => F.foldLeft(fa, M.empty, (b, a) => M.combine(b, f(a)));
}

/**
 * Convert to a list
 */
export function toList<F>(F: Foldable<F>): <A>(fa: Kind<F, A>) => A[] {
  return (fa) => F.foldRight(fa, [] as A[], (a, acc) => [a, ...acc]);
}

/**
 * Convert to array (alias for toList with better semantics)
 */
export function toArray<F>(F: Foldable<F>): <A>(fa: Kind<F, A>) => A[] {
  return (fa) => F.foldLeft(fa, [] as A[], (acc, a) => [...acc, a]);
}

/**
 * Check if the structure is empty
 */
export function isEmpty<F>(F: Foldable<F>): <A>(fa: Kind<F, A>) => boolean {
  return (fa) => F.foldLeft(fa, true, () => false);
}

/**
 * Check if the structure is non-empty
 */
export function nonEmpty<F>(F: Foldable<F>): <A>(fa: Kind<F, A>) => boolean {
  return (fa) => !isEmpty(F)(fa);
}

/**
 * Get the size of the structure
 */
export function size<F>(F: Foldable<F>): <A>(fa: Kind<F, A>) => number {
  return (fa) => F.foldLeft(fa, 0, (acc, _) => acc + 1);
}

/**
 * Check if any element satisfies the predicate
 */
export function exists<F>(
  F: Foldable<F>,
): <A>(fa: Kind<F, A>, p: (a: A) => boolean) => boolean {
  return (fa, p) => F.foldLeft(fa, false, (acc, a) => acc || p(a));
}

/**
 * Check if all elements satisfy the predicate
 */
export function forall<F>(
  F: Foldable<F>,
): <A>(fa: Kind<F, A>, p: (a: A) => boolean) => boolean {
  return (fa, p) => F.foldLeft(fa, true, (acc, a) => acc && p(a));
}

/**
 * Find the first element that satisfies the predicate
 */
export function find<F>(
  F: Foldable<F>,
): <A>(fa: Kind<F, A>, p: (a: A) => boolean) => A | undefined {
  return (fa, p) =>
    F.foldLeft(fa, undefined as A | undefined, (acc, a) =>
      acc !== undefined ? acc : p(a) ? a : undefined,
    );
}

/**
 * Count elements that satisfy the predicate
 */
export function count<F>(
  F: Foldable<F>,
): <A>(fa: Kind<F, A>, p: (a: A) => boolean) => number {
  return (fa, p) => F.foldLeft(fa, 0, (acc, a) => (p(a) ? acc + 1 : acc));
}

/**
 * Check if the structure contains an element
 */
export function contains<F>(
  F: Foldable<F>,
): <A>(fa: Kind<F, A>, a: A, eq?: (x: A, y: A) => boolean) => boolean {
  return (fa, a, eq = (x, y) => x === y) => exists(F)(fa, (x) => eq(x, a));
}

/**
 * Get the first element
 */
export function head<F>(F: Foldable<F>): <A>(fa: Kind<F, A>) => A | undefined {
  return (fa) =>
    F.foldLeft(fa, undefined as A | undefined, (acc, a) =>
      acc !== undefined ? acc : a,
    );
}

/**
 * Get the last element
 */
export function last<F>(F: Foldable<F>): <A>(fa: Kind<F, A>) => A | undefined {
  return (fa) => F.foldLeft(fa, undefined as A | undefined, (_, a) => a);
}

/**
 * Get the minimum element (requires a comparison function)
 */
export function minimum<F>(
  F: Foldable<F>,
): <A>(fa: Kind<F, A>, compare: (a: A, b: A) => number) => A | undefined {
  return (fa, compare) =>
    F.foldLeft(fa, undefined as A | undefined, (acc, a) =>
      acc === undefined ? a : compare(a, acc) < 0 ? a : acc,
    );
}

/**
 * Get the maximum element (requires a comparison function)
 */
export function maximum<F>(
  F: Foldable<F>,
): <A>(fa: Kind<F, A>, compare: (a: A, b: A) => number) => A | undefined {
  return (fa, compare) =>
    F.foldLeft(fa, undefined as A | undefined, (acc, a) =>
      acc === undefined ? a : compare(a, acc) > 0 ? a : acc,
    );
}

/**
 * Perform a side effect for each element
 */
export function forEach_<F>(
  F: Foldable<F>,
): <A>(fa: Kind<F, A>, f: (a: A) => void) => void {
  return (fa, f) => {
    F.foldLeft(fa, undefined, (_, a) => {
      f(a);
      return undefined;
    });
  };
}

/**
 * Join strings with a separator
 */
export function mkString<F>(
  F: Foldable<F>,
): (fa: Kind<F, string>, sep: string) => string {
  return (fa, sep) => {
    const arr = toArray(F)(fa);
    return arr.join(sep);
  };
}

/**
 * Intercalate - intersperse and fold
 */
export function intercalate<F>(
  F: Foldable<F>,
): <A>(fa: Kind<F, A>, sep: A, M: Monoid<A>) => A {
  return (fa, sep, M) => {
    const arr = toArray(F)(fa);
    if (arr.length === 0) return M.empty;
    return arr.reduce((acc, a, i) =>
      i === 0 ? a : M.combine(M.combine(acc, sep), a),
    );
  };
}

// ============================================================================
// Instance Creator
// ============================================================================

/**
 * Create a Foldable instance
 */
export function makeFoldable<F>(
  URI: F,
  foldLeft: <A, B>(fa: Kind<F, A>, b: B, f: (b: B, a: A) => B) => B,
  foldRight: <A, B>(fa: Kind<F, A>, b: B, f: (a: A, b: B) => B) => B,
): Foldable<F> {
  return { URI, foldLeft, foldRight };
}
