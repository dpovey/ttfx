/**
 * Traverse Typeclass
 *
 * A type class for data structures that can be traversed with an effect.
 * Traverse extends both Functor and Foldable.
 *
 * Laws:
 *   - Identity: traverse(Id)(fa, id) === Id(fa)
 *   - Naturality: t(traverse(G)(fa, f)) === traverse(H)(fa, t . f)
 *   - Composition: traverse(Compose(G, H))(fa, Compose . fmap g . f) ===
 *                  Compose(traverse(G)(traverse(H)(fa, g), f))
 */

import type { Functor, Functor2 } from "./functor.js";
import type { Foldable, Foldable2 } from "./foldable.js";
import type { Applicative, Applicative2 } from "./applicative.js";
import type { Kind, Kind2 } from "../hkt.js";

// ============================================================================
// Traverse
// ============================================================================

/**
 * Traverse typeclass
 */
export interface Traverse<T> extends Functor<T>, Foldable<T> {
  readonly traverse: <G, A, B>(
    G: Applicative<G>,
    ta: Kind<T, A>,
    f: (a: A) => Kind<G, B>,
  ) => Kind<G, Kind<T, B>>;
}

/**
 * Traverse for 2-arity type constructors
 */
export interface Traverse2<T> extends Functor2<T>, Foldable2<T> {
  readonly traverse: <G, E, A, B>(
    G: Applicative<G>,
    ta: Kind2<T, E, A>,
    f: (a: A) => Kind<G, B>,
  ) => Kind<G, Kind2<T, E, B>>;
}

// ============================================================================
// Derived Operations
// ============================================================================

/**
 * Sequence the effects in a traversable, collecting results
 */
export function sequence<T>(
  T: Traverse<T>,
): <G>(
  G: Applicative<G>,
) => <A>(tga: Kind<T, Kind<G, A>>) => Kind<G, Kind<T, A>> {
  return (G) => (tga) => T.traverse(G, tga, (ga) => ga);
}

/**
 * A flattened version of traverse for functions that return nested structures
 */
export function flatTraverse<T>(
  T: Traverse<T>,
): <G>(
  G: Applicative<G>,
) => <A, B>(
  ta: Kind<T, A>,
  f: (a: A) => Kind<G, Kind<T, B>>,
) => Kind<G, Kind<T, B>> {
  return (G) => (ta, f) => {
    const nested = T.traverse(G, ta, f);
    return nested as unknown as Kind<G, Kind<T, B>>;
  };
}

/**
 * Traverse with an action that returns void, discarding results
 */
export function traverse_<T>(
  T: Traverse<T>,
): <G>(
  G: Applicative<G>,
) => <A, B>(ta: Kind<T, A>, f: (a: A) => Kind<G, B>) => Kind<G, void> {
  return (G) => (ta, f) => G.map(T.traverse(G, ta, f), () => undefined);
}

/**
 * Perform an effectful action for each element, collecting results
 * but only keeping those where the effect returns non-null
 */
export function traverseFilter<T>(
  T: Traverse<T>,
): <G>(
  G: Applicative<G>,
) => <A, B>(
  ta: Kind<T, A>,
  f: (a: A) => Kind<G, B | null>,
) => Kind<G, (B | null)[]> {
  return (G) => (ta, f) => {
    const mapped = T.traverse(G, ta, f);
    return G.map(mapped, (tb) => {
      const result: (B | null)[] = [];
      T.foldLeft(tb, result, (acc, b) => {
        acc.push(b);
        return acc;
      });
      return result;
    });
  };
}

/**
 * Map each element to an option, collecting only the non-null values
 */
export function mapFilter<T>(
  T: Traverse<T>,
): <A, B>(ta: Kind<T, A>, f: (a: A) => B | null) => B[] {
  return (ta, f) => {
    const results: B[] = [];
    T.foldLeft(ta, results, (acc, a) => {
      const result = f(a);
      if (result !== null) {
        acc.push(result);
      }
      return acc;
    });
    return results;
  };
}

/**
 * Traverse with index
 */
export function traverseWithIndex<T>(
  T: Traverse<T>,
): <G>(
  G: Applicative<G>,
) => <A, B>(
  ta: Kind<T, A>,
  f: (index: number, a: A) => Kind<G, B>,
) => Kind<G, Kind<T, B>> {
  return (G) => (ta, f) => {
    let index = 0;
    return T.traverse(G, ta, (a) => {
      const result = f(index, a);
      index++;
      return result;
    });
  };
}

/**
 * For each element, perform an action and return the original
 */
export function forM<T>(
  T: Traverse<T>,
): <G>(
  G: Applicative<G>,
) => <A, B>(ta: Kind<T, A>, f: (a: A) => Kind<G, B>) => Kind<G, Kind<T, A>> {
  return (G) => (ta, f) => T.traverse(G, ta, (a) => G.map(f(a), () => a));
}

// ============================================================================
// Instance Creator
// ============================================================================

/**
 * Create a Traverse instance
 */
export function makeTraverse<T>(
  functor: Functor<T>,
  foldable: Foldable<T>,
  traverse: <G, A, B>(
    G: Applicative<G>,
    ta: Kind<T, A>,
    f: (a: A) => Kind<G, B>,
  ) => Kind<G, Kind<T, B>>,
): Traverse<T> {
  return {
    ...functor,
    ...foldable,
    traverse,
  };
}

// ============================================================================
// Array Traverse Instance
// ============================================================================

/**
 * Traverse for arrays
 */
export function traverseArray<G>(
  G: Applicative<G>,
): <A, B>(arr: A[], f: (a: A) => Kind<G, B>) => Kind<G, B[]> {
  return (arr, f) => {
    if (arr.length === 0) {
      return G.pure([]);
    }

    return arr.reduce(
      (acc: Kind<G, B[]>, a: A) =>
        G.ap(
          G.map(acc, (bs) => (b: B) => [...bs, b]),
          f(a),
        ),
      G.pure([] as B[]),
    );
  };
}

/**
 * Sequence for arrays
 */
export function sequenceArray<G>(
  G: Applicative<G>,
): <A>(arr: Kind<G, A>[]) => Kind<G, A[]> {
  return (arr) => traverseArray(G)(arr, (ga) => ga);
}
