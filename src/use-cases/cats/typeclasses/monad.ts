/**
 * FlatMap and Monad Typeclasses
 *
 * FlatMap extends Apply with the ability to sequence computations.
 * Monad extends FlatMap and Applicative.
 *
 * Laws:
 *   - Left identity: pure(a).flatMap(f) === f(a)
 *   - Right identity: m.flatMap(pure) === m
 *   - Associativity: m.flatMap(f).flatMap(g) === m.flatMap(a => f(a).flatMap(g))
 */

import type {
  Apply,
  Apply2,
  Applicative,
  Applicative2,
} from "./applicative.js";
import type { Kind, Kind2 } from "../hkt.js";

// ============================================================================
// FlatMap
// ============================================================================

/**
 * FlatMap typeclass - extends Apply with flatMap
 */
export interface FlatMap<F> extends Apply<F> {
  readonly flatMap: <A, B>(
    fa: Kind<F, A>,
    f: (a: A) => Kind<F, B>,
  ) => Kind<F, B>;
}

/**
 * FlatMap for 2-arity type constructors
 */
export interface FlatMap2<F> extends Apply2<F> {
  readonly flatMap: <E, A, B>(
    fa: Kind2<F, E, A>,
    f: (a: A) => Kind2<F, E, B>,
  ) => Kind2<F, E, B>;
}

// ============================================================================
// Monad
// ============================================================================

/**
 * Monad typeclass - extends FlatMap and Applicative
 */
export interface Monad<F> extends FlatMap<F>, Applicative<F> {}

/**
 * Monad for 2-arity type constructors
 */
export interface Monad2<F> extends FlatMap2<F>, Applicative2<F> {}

// ============================================================================
// Derived Operations from FlatMap
// ============================================================================

/**
 * Flatten a nested structure
 */
export function flatten<F>(
  F: FlatMap<F>,
): <A>(ffa: Kind<F, Kind<F, A>>) => Kind<F, A> {
  return (ffa) => F.flatMap(ffa, (fa) => fa);
}

/**
 * Execute an action for its side effect, discarding the result
 */
export function flatTap<F>(
  F: FlatMap<F>,
): <A, B>(fa: Kind<F, A>, f: (a: A) => Kind<F, B>) => Kind<F, A> {
  return (fa, f) => F.flatMap(fa, (a) => F.map(f(a), () => a));
}

/**
 * Conditional execution based on a boolean in the context
 */
export function ifM<F>(
  F: FlatMap<F>,
): <A>(
  cond: Kind<F, boolean>,
  ifTrue: () => Kind<F, A>,
  ifFalse: () => Kind<F, A>,
) => Kind<F, A> {
  return (cond, ifTrue, ifFalse) =>
    F.flatMap(cond, (b) => (b ? ifTrue() : ifFalse()));
}

/**
 * Tail-recursive monadic loop
 */
export function tailRecM<F>(
  F: FlatMap<F>,
): <A, B>(
  a: A,
  f: (a: A) => Kind<F, { done: boolean; value: A | B }>,
) => Kind<F, B> {
  return (a, f) => {
    const step = (current: A): Kind<F, B> =>
      F.flatMap(f(current), (result) =>
        result.done
          ? F.map(
              F.map(f(current), () => result.value as B),
              (b) => b,
            )
          : step(result.value as A),
      );
    return step(a);
  };
}

/**
 * Execute an action repeatedly while the predicate holds
 */
export function whileM_<F>(
  F: Monad<F>,
): (cond: Kind<F, boolean>, body: Kind<F, void>) => Kind<F, void> {
  return (cond, body) =>
    F.flatMap(cond, (b) =>
      b ? F.flatMap(body, () => whileM_(F)(cond, body)) : F.pure(undefined),
    );
}

/**
 * Execute an action repeatedly until the predicate holds
 */
export function untilM_<F>(
  F: Monad<F>,
): (body: Kind<F, void>, cond: Kind<F, boolean>) => Kind<F, void> {
  return (body, cond) =>
    F.flatMap(body, () =>
      F.flatMap(cond, (b) => (b ? F.pure(undefined) : untilM_(F)(body, cond))),
    );
}

/**
 * Sequence a list of monadic actions and collect results
 */
export function sequence<F>(
  F: Monad<F>,
): <A>(fas: Kind<F, A>[]) => Kind<F, A[]> {
  return (fas) =>
    fas.reduce(
      (acc, fa) => F.flatMap(acc, (arr) => F.map(fa, (a) => [...arr, a])),
      F.pure([] as A[]),
    );
}

/**
 * Map each element to a monadic action and sequence the results
 */
export function traverse<F>(
  F: Monad<F>,
): <A, B>(as: A[], f: (a: A) => Kind<F, B>) => Kind<F, B[]> {
  return (as, f) => sequence(F)(as.map(f));
}

/**
 * Sequence actions, discarding results
 */
export function sequence_<F>(
  F: Monad<F>,
): <A>(fas: Kind<F, A>[]) => Kind<F, void> {
  return (fas) =>
    fas.reduce(
      (acc, fa) => F.flatMap(acc, () => F.map(fa, () => undefined)),
      F.pure(undefined) as Kind<F, void>,
    );
}

// ============================================================================
// Instance Creators
// ============================================================================

/**
 * Create a Monad from pure and flatMap (derives map and ap)
 *
 * This is the most convenient way to create a Monad instance.
 * `map` is derived as `flatMap(fa, a => pure(f(a)))`.
 * `ap` is derived as `flatMap(fab, f => flatMap(fa, a => pure(f(a))))`.
 */
export function makeMonad<F>(
  URI: F,
  pure: <A>(a: A) => Kind<F, A>,
  flatMap: <A, B>(fa: Kind<F, A>, f: (a: A) => Kind<F, B>) => Kind<F, B>,
): Monad<F> {
  return {
    URI,
    pure,
    flatMap,
    map: (fa, f) => flatMap(fa, (a) => pure(f(a))),
    ap: (fab, fa) => flatMap(fab, (f) => flatMap(fa, (a) => pure(f(a)))),
  };
}

/**
 * Create a Monad2 from pure and flatMap (derives map and ap)
 */
export function makeMonad2<F>(
  URI: F,
  pure: <E, A>(a: A) => Kind2<F, E, A>,
  flatMap: <E, A, B>(
    fa: Kind2<F, E, A>,
    f: (a: A) => Kind2<F, E, B>,
  ) => Kind2<F, E, B>,
): Monad2<F> {
  return {
    URI,
    pure,
    flatMap,
    map: (fa, f) => flatMap(fa, (a) => pure(f(a))),
    ap: (fab, fa) => flatMap(fab, (f) => flatMap(fa, (a) => pure(f(a)))),
  };
}
