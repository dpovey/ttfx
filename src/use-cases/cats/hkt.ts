/**
 * Higher-Kinded Types Foundation for Cats
 *
 * Unified HKT system — all typeclasses use `Kind<F, A>` from the base
 * infrastructure, which resolves to concrete types at compile time.
 *
 * Combined with the `specialize` macro, this enables zero-cost typeclass
 * abstractions: write generic code with Functor/Monad/etc., and the macro
 * system eliminates dictionary passing and indirect dispatch at compile time.
 *
 * ## Zero-Cost Philosophy
 *
 * The HKT encoding exists only at the type level. At runtime:
 * - Brand interfaces (`ArrayHKT`, `OptionHKT`) are erased
 * - `Kind<F, A>` resolves to concrete types (`Array<A>`, `Option<A>`)
 * - The `specialize` macro inlines dictionary methods at call sites
 * - No closures, no indirect dispatch, no dictionary objects in hot paths
 */

// Re-export core HKT infrastructure — this is the single source of truth
export {
  Kind,
  Kind2,
  HKTRegistry,
  ArrayHKT,
  PromiseHKT,
  MapHKT,
  SetHKT,
  ReadonlyArrayHKT,
} from "../type-system/hkt.js";

import type { Kind, Kind2, HKTRegistry } from "../type-system/hkt.js";

// ============================================================================
// Extended HKT Infrastructure
// ============================================================================

/** Unique symbol for HKT URI branding */
declare const __hkt_uri__: unique symbol;

/**
 * Kind with three type arguments (for types like StateT, ReaderT, etc.)
 */
export type Kind3<F, R, E, A> = F extends { readonly [__hkt_uri__]: infer URI }
  ? URI extends keyof HKT3Registry
    ? (HKT3Registry[URI] & {
        readonly __arg__: A;
        readonly __arg2__: E;
        readonly __arg3__: R;
      })["type"]
    : { readonly __hkt_error__: "URI not registered in HKT3Registry"; uri: URI }
  : { readonly __hkt_error__: "F is not an HKT-branded type"; f: F };

/**
 * HKT3 Registry for 3-arity type constructors
 */
export interface HKT3Registry {}

// ============================================================================
// HKT Brands for Cats Data Types
// ============================================================================

/** HKT brand for Option */
export interface OptionHKT {
  readonly [__hkt_uri__]: "Option";
}

/** HKT brand for Either */
export interface EitherHKT {
  readonly [__hkt_uri__]: "Either";
}

/** HKT brand for List */
export interface ListHKT {
  readonly [__hkt_uri__]: "List";
}

/** HKT brand for NonEmptyList */
export interface NonEmptyListHKT {
  readonly [__hkt_uri__]: "NonEmptyList";
}

/** HKT brand for Validated */
export interface ValidatedHKT {
  readonly [__hkt_uri__]: "Validated";
}

/** HKT brand for State */
export interface StateHKT {
  readonly [__hkt_uri__]: "State";
}

/** HKT brand for Reader */
export interface ReaderHKT {
  readonly [__hkt_uri__]: "Reader";
}

/** HKT brand for Writer */
export interface WriterHKT {
  readonly [__hkt_uri__]: "Writer";
}

/** HKT brand for IO */
export interface IOHKT {
  readonly [__hkt_uri__]: "IO";
}

/** HKT brand for Id (Identity) */
export interface IdHKT {
  readonly [__hkt_uri__]: "Id";
}

/** HKT brand for Resource */
export interface ResourceHKT {
  readonly [__hkt_uri__]: "Resource";
}

// ============================================================================
// Forward Declarations (resolved by actual implementations)
// ============================================================================

/** Forward declaration for Option */
export interface Option<A> {
  readonly _tag: "Some" | "None";
  map<B>(f: (a: A) => B): Option<B>;
  flatMap<B>(f: (a: A) => Option<B>): Option<B>;
}

/** Forward declaration for Either */
export interface Either<E, A> {
  readonly _tag: "Left" | "Right";
  map<B>(f: (a: A) => B): Either<E, B>;
  flatMap<B>(f: (a: A) => Either<E, B>): Either<E, B>;
}

/** Forward declaration for List */
export interface List<A> {
  readonly _tag: "Cons" | "Nil";
  map<B>(f: (a: A) => B): List<B>;
  flatMap<B>(f: (a: A) => List<B>): List<B>;
}

/** Forward declaration for NonEmptyList */
export interface NonEmptyList<A> {
  readonly head: A;
  readonly tail: List<A>;
  map<B>(f: (a: A) => B): NonEmptyList<B>;
  flatMap<B>(f: (a: A) => NonEmptyList<B>): NonEmptyList<B>;
}

/** Forward declaration for Validated */
export interface Validated<E, A> {
  readonly _tag: "Valid" | "Invalid";
  map<B>(f: (a: A) => B): Validated<E, B>;
}

/** Forward declaration for State */
export interface State<S, A> {
  run(s: S): [A, S];
  map<B>(f: (a: A) => B): State<S, B>;
  flatMap<B>(f: (a: A) => State<S, B>): State<S, B>;
}

/** Forward declaration for Reader */
export interface Reader<R, A> {
  run(r: R): A;
  map<B>(f: (a: A) => B): Reader<R, B>;
  flatMap<B>(f: (a: A) => Reader<R, B>): Reader<R, B>;
}

/** Forward declaration for Writer */
export interface Writer<W, A> {
  run(): [W, A];
  map<B>(f: (a: A) => B): Writer<W, B>;
  flatMap<B>(f: (a: A) => Writer<W, B>): Writer<W, B>;
}

/** Forward declaration for IO */
export interface IO<A> {
  map<B>(f: (a: A) => B): IO<B>;
  flatMap<B>(f: (a: A) => IO<B>): IO<B>;
}

/** Forward declaration for Id (Identity) */
export type Id<A> = A;

// ============================================================================
// HKT Utility Types
// ============================================================================

/**
 * Extract the type argument from a Kind
 */
export type KindOf<FA> = FA extends { readonly __arg__: infer A } ? A : never;

/**
 * Type-safe cast for HKT operations.
 * Used internally by typeclass instances to bridge the gap between
 * Kind<F, A> (which resolves at the type level) and the concrete runtime type.
 */
export function unsafeCoerce<A, B>(a: A): B {
  return a as unknown as B;
}
