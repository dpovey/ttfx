/**
 * ApplicativeError and MonadError Typeclasses
 *
 * ApplicativeError extends Applicative with error handling capabilities.
 * MonadError combines Monad and ApplicativeError.
 */

import type { Applicative, Applicative2 } from "./applicative.js";
import type { Monad, Monad2 } from "./monad.js";
import type { Kind, Kind2 } from "../hkt.js";

// ============================================================================
// ApplicativeError
// ============================================================================

/**
 * ApplicativeError typeclass - Applicative with error handling
 */
export interface ApplicativeError<F, E> extends Applicative<F> {
  readonly raiseError: <A>(e: E) => Kind<F, A>;
  readonly handleErrorWith: <A>(
    fa: Kind<F, A>,
    f: (e: E) => Kind<F, A>,
  ) => Kind<F, A>;
}

/**
 * ApplicativeError for 2-arity type constructors
 */
export interface ApplicativeError2<F> extends Applicative2<F> {
  readonly raiseError: <E, A>(e: E) => Kind2<F, E, A>;
  readonly handleErrorWith: <E, A>(
    fa: Kind2<F, E, A>,
    f: (e: E) => Kind2<F, E, A>,
  ) => Kind2<F, E, A>;
}

// ============================================================================
// MonadError
// ============================================================================

/**
 * MonadError typeclass - combines Monad and ApplicativeError
 */
export interface MonadError<F, E> extends Monad<F>, ApplicativeError<F, E> {}

/**
 * MonadError for 2-arity type constructors
 */
export interface MonadError2<F> extends Monad2<F>, ApplicativeError2<F> {}

// ============================================================================
// Either type for attempt
// ============================================================================

type EitherType<E, A> =
  | { readonly _tag: "Left"; readonly left: E }
  | { readonly _tag: "Right"; readonly right: A };

const LeftE = <E, A>(left: E): EitherType<E, A> => ({ _tag: "Left", left });
const RightE = <E, A>(right: A): EitherType<E, A> => ({
  _tag: "Right",
  right,
});

// ============================================================================
// Derived Operations
// ============================================================================

/**
 * Handle errors with a pure recovery function
 */
export function handleError<F, E>(
  F: ApplicativeError<F, E>,
): <A>(fa: Kind<F, A>, f: (e: E) => A) => Kind<F, A> {
  return (fa, f) => F.handleErrorWith(fa, (e) => F.pure(f(e)));
}

/**
 * Attempt to run a computation, capturing the error as an Either
 */
export function attempt<F, E>(
  F: ApplicativeError<F, E>,
): <A>(fa: Kind<F, A>) => Kind<F, EitherType<E, A>> {
  return (fa) =>
    F.handleErrorWith(
      F.map(fa, (a) => RightE<E, A>(a)),
      (e) => F.pure(LeftE<E, A>(e)),
    );
}

/**
 * Recover from errors with a partial function
 */
export function recover<F, E>(
  F: ApplicativeError<F, E>,
): <A>(fa: Kind<F, A>, f: (e: E) => A | null) => Kind<F, A> {
  return (fa, f) =>
    F.handleErrorWith(fa, (e) => {
      const result = f(e);
      if (result === null) {
        return F.raiseError(e);
      }
      return F.pure(result);
    });
}

/**
 * Recover from errors with a partial function that returns an effect
 */
export function recoverWith<F, E>(
  F: ApplicativeError<F, E>,
): <A>(fa: Kind<F, A>, f: (e: E) => Kind<F, A> | null) => Kind<F, A> {
  return (fa, f) =>
    F.handleErrorWith(fa, (e) => {
      const result = f(e);
      if (result === null) {
        return F.raiseError(e);
      }
      return result;
    });
}

/**
 * If the value satisfies the predicate, return it; otherwise raise an error
 */
export function ensure<F, E>(
  F: MonadError<F, E>,
): <A>(
  fa: Kind<F, A>,
  error: (a: A) => E,
  predicate: (a: A) => boolean,
) => Kind<F, A> {
  return (fa, error, predicate) =>
    F.flatMap(fa, (a) => (predicate(a) ? F.pure(a) : F.raiseError(error(a))));
}

/**
 * If the value does not satisfy the predicate, return it; otherwise raise an error
 */
export function ensureOr<F, E>(
  F: MonadError<F, E>,
): <A>(fa: Kind<F, A>, error: E, predicate: (a: A) => boolean) => Kind<F, A> {
  return (fa, error, predicate) =>
    F.flatMap(fa, (a) => (predicate(a) ? F.pure(a) : F.raiseError(error)));
}

/**
 * Re-raise errors that match a predicate
 */
export function rethrow<F, E>(
  F: MonadError<F, E>,
): <A>(fa: Kind<F, EitherType<E, A>>) => Kind<F, A> {
  return (fa) =>
    F.flatMap(fa, (either) => {
      if (either._tag === "Left") {
        return F.raiseError(either.left);
      }
      return F.pure(either.right);
    });
}

/**
 * Adapt the error type
 */
export function adaptError<F, E>(
  F: ApplicativeError<F, E>,
): <A>(fa: Kind<F, A>, f: (e: E) => E) => Kind<F, A> {
  return (fa, f) => F.handleErrorWith(fa, (e) => F.raiseError(f(e)));
}

/**
 * Execute a side effect on error
 */
export function onError<F, E>(
  F: MonadError<F, E>,
): <A>(fa: Kind<F, A>, f: (e: E) => Kind<F, void>) => Kind<F, A> {
  return (fa, f) =>
    F.handleErrorWith(fa, (e) => F.flatMap(f(e), () => F.raiseError<A>(e)));
}

/**
 * Catch and transform errors that match a predicate
 */
export function catchNonFatal<F, E>(
  F: ApplicativeError<F, E>,
): <A>(thunk: () => A, toError: (err: unknown) => E) => Kind<F, A> {
  return (thunk, toError) => {
    try {
      return F.pure(thunk());
    } catch (err) {
      return F.raiseError(toError(err));
    }
  };
}

// ============================================================================
// Instance Creators
// ============================================================================

/**
 * Create an ApplicativeError instance
 */
export function makeApplicativeError<F, E>(
  applicative: Applicative<F>,
  raiseError: <A>(e: E) => Kind<F, A>,
  handleErrorWith: <A>(fa: Kind<F, A>, f: (e: E) => Kind<F, A>) => Kind<F, A>,
): ApplicativeError<F, E> {
  return { ...applicative, raiseError, handleErrorWith };
}

/**
 * Create a MonadError instance
 */
export function makeMonadError<F, E>(
  monad: Monad<F>,
  raiseError: <A>(e: E) => Kind<F, A>,
  handleErrorWith: <A>(fa: Kind<F, A>, f: (e: E) => Kind<F, A>) => Kind<F, A>,
): MonadError<F, E> {
  return { ...monad, raiseError, handleErrorWith };
}
