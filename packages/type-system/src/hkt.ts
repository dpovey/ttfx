/**
 * Higher-Kinded Types (HKT) via Indexed Access Encoding
 *
 * This module provides a lightweight, zero-cost HKT encoding for TypeScript
 * using the indexed-access pattern. Unlike the old URI-branding approach,
 * this encoding:
 *
 * - Is natively understood by TypeScript (no registry, no module augmentation)
 * - Requires no `as unknown as` casts
 * - Has zero runtime overhead (types only, no brand objects)
 * - Works seamlessly with IDE tooling
 *
 * ## How it works
 *
 * The core insight is that TypeScript can use indexed access on intersection
 * types to simulate type-level function application:
 *
 * ```typescript
 * type $<F, A> = (F & { readonly _: A })["_"];
 * ```
 *
 * A "type-level function" is an interface with a `_` property that uses
 * `this["_"]` to reference the type argument:
 *
 * ```typescript
 * interface ArrayF { _: Array<this["_"]> }
 * interface OptionF { _: Option<this["_"]> }
 * ```
 *
 * Then `$<ArrayF, number>` evaluates to `Array<number>`:
 * 1. `ArrayF & { readonly _: number }` creates `{ _: Array<this["_"]> } & { readonly _: number }`
 * 2. Looking up `["_"]` on this intersection yields `Array<number>`
 *
 * ## Usage
 *
 * ```typescript
 * import { $, Kind } from "@ttfx/type-system";
 *
 * // Define a type-level function for your type
 * interface OptionF { _: Option<this["_"]> }
 *
 * // Use in typeclass definitions
 * interface Functor<F> {
 *   map<A, B>(fa: $<F, A>, f: (a: A) => B): $<F, B>;
 * }
 *
 * // Use in generic functions
 * function double<F>(F: Functor<F>, fa: $<F, number>): $<F, number> {
 *   return F.map(fa, x => x * 2);
 * }
 * ```
 *
 * ## Multi-arity type constructors
 *
 * For type constructors with multiple parameters, fix all but one:
 *
 * ```typescript
 * // Either<E, A> - fix E, vary A
 * interface EitherF<E> { _: Either<E, this["_"]> }
 *
 * // Map<K, V> - fix K, vary V
 * interface MapF<K> { _: Map<K, this["_"]> }
 * ```
 */

// ============================================================================
// Core HKT Encoding
// ============================================================================

/**
 * Type-level function application.
 *
 * `$<F, A>` applies the type-level function `F` to the type argument `A`.
 * `F` must be an interface with a `_` property that uses `this["_"]`.
 *
 * @example
 * ```typescript
 * interface ArrayF { _: Array<this["_"]> }
 * type Numbers = $<ArrayF, number>; // Array<number>
 * ```
 */
export type $<F, A> = (F & { readonly _: A })["_"];

/**
 * Alias for `$<F, A>` — provided for familiarity with fp-ts style.
 *
 * Both `Kind<F, A>` and `$<F, A>` are identical; use whichever you prefer.
 */
export type Kind<F, A> = $<F, A>;

// ============================================================================
// Built-in Type-Level Functions for Standard TypeScript Types
// ============================================================================

/**
 * Type-level function for `Array<A>`.
 *
 * @example
 * ```typescript
 * type Numbers = $<ArrayF, number>; // Array<number>
 * ```
 */
export interface ArrayF {
  _: Array<this["_"]>;
}

/**
 * Type-level function for `Promise<A>`.
 *
 * @example
 * ```typescript
 * type AsyncNumber = $<PromiseF, number>; // Promise<number>
 * ```
 */
export interface PromiseF {
  _: Promise<this["_"]>;
}

/**
 * Type-level function for `Set<A>`.
 *
 * @example
 * ```typescript
 * type NumberSet = $<SetF, number>; // Set<number>
 * ```
 */
export interface SetF {
  _: Set<this["_"]>;
}

/**
 * Type-level function for `ReadonlyArray<A>`.
 *
 * @example
 * ```typescript
 * type RONumbers = $<ReadonlyArrayF, number>; // readonly number[]
 * ```
 */
export interface ReadonlyArrayF {
  _: ReadonlyArray<this["_"]>;
}

/**
 * Type-level function for `Map<K, V>` with K fixed.
 *
 * @example
 * ```typescript
 * type StringToNumber = $<MapF<string>, number>; // Map<string, number>
 * ```
 */
export interface MapF<K> {
  _: Map<K, this["_"]>;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Unsafe coercion between types.
 *
 * Use sparingly — this bypasses TypeScript's type checking.
 * Primarily useful in typeclass implementations where the
 * type system cannot track certain invariants.
 */
export function unsafeCoerce<A, B>(a: A): B {
  return a as unknown as B;
}

// ============================================================================
// Legacy Compatibility (deprecated, will be removed)
// ============================================================================

/**
 * @deprecated Use `ArrayF` instead. Legacy HKT brand for Array.
 */
export interface ArrayHKT {
  readonly _brand: "ArrayHKT";
}

/**
 * @deprecated Use `PromiseF` instead. Legacy HKT brand for Promise.
 */
export interface PromiseHKT {
  readonly _brand: "PromiseHKT";
}
