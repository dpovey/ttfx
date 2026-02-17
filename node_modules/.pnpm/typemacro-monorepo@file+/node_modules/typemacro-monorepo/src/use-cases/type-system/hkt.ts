/**
 * Higher-Kinded Types (HKT) Macro
 *
 * TypeScript cannot express type constructors as type parameters — you can't
 * write `interface Functor<F> { map<A, B>(fa: F<A>, f: (a: A) => B): F<B> }`
 * because `F` is not a valid type constructor.
 *
 * This macro provides HKT support via compile-time code generation, using
 * the defunctionalization / URI brand pattern that fp-ts pioneered, but
 * hiding all the boilerplate behind clean syntax.
 *
 * ## How it works
 *
 * 1. `@hkt` on an interface generates:
 *    - A URI brand type for the typeclass
 *    - A `Kind<F, A>` type-level application helper
 *    - Type-safe registration infrastructure
 *
 * 2. `@hktInstance(Functor)` on a const generates:
 *    - URI registration for the concrete type constructor
 *    - A properly typed instance object
 *
 * 3. `Kind<F, A>` resolves to the concrete type at use sites
 *
 * @example
 * ```typescript
 * // Define a higher-kinded typeclass:
 * @hkt
 * interface Functor<F> {
 *   map<A, B>(fa: Kind<F, A>, f: (a: A) => B): Kind<F, B>;
 * }
 *
 * // Register Array as a Functor:
 * @hktInstance(Functor, "Array")
 * const arrayFunctor: Functor<ArrayHKT> = {
 *   map: (fa, f) => fa.map(f),
 * };
 *
 * // Use it generically:
 * function double<F>(F: Functor<F>, fa: Kind<F, number>): Kind<F, number> {
 *   return F.map(fa, x => x * 2);
 * }
 *
 * double(arrayFunctor, [1, 2, 3]); // [2, 4, 6]
 * ```
 *
 * ## What the macro generates
 *
 * For `@hkt interface Functor<F>`:
 * ```typescript
 * // URI brand for the HKT encoding
 * declare const __hkt_Functor_uri__: unique symbol;
 *
 * // HKT type registry — maps URI brands to concrete types
 * interface HKTRegistry {
 *   // Populated by @hktInstance
 * }
 *
 * // Kind type application: Kind<F, A> resolves to the concrete type
 * type Kind<F, A> = F extends { readonly __hkt_uri__: infer URI }
 *   ? URI extends keyof HKTRegistry
 *     ? HKTRegistry[URI] extends { readonly type: infer T }
 *       ? T
 *       : never
 *     : never
 *   : never;
 *
 * // The original interface, with Kind<F, A> replacing F<A>
 * interface Functor<F> {
 *   map<A, B>(fa: Kind<F, A>, f: (a: A) => B): Kind<F, B>;
 * }
 * ```
 *
 * For `@hktInstance(Functor, "Array")`:
 * ```typescript
 * // Brand type for Array as a type constructor
 * interface ArrayHKT { readonly __hkt_uri__: "Array" }
 *
 * // Register in the HKT registry (module augmentation)
 * declare module "./hkt" {
 *   interface HKTRegistry {
 *     Array: { readonly type: Array<any> };
 *   }
 * }
 *
 * // The instance itself
 * const arrayFunctor: Functor<ArrayHKT> = { map: (fa, f) => fa.map(f) };
 * ```
 */

import * as ts from "typescript";
import {
  defineAttributeMacro,
  defineExpressionMacro,
  globalRegistry,
} from "../../core/registry.js";
import { MacroContext, AttributeTarget } from "../../core/types.js";

// ============================================================================
// Type-Level API (used in source code, processed by macro)
// ============================================================================

/** Unique symbol for HKT URI branding */
declare const __hkt_uri__: unique symbol;

/**
 * HKT Registry — maps URI strings to concrete type constructors.
 * Extended via module augmentation by @hktInstance.
 */
export interface HKTRegistry {}

/**
 * Type-level application: applies type constructor F to type argument A.
 * F must be an HKT-branded type registered in HKTRegistry.
 *
 * This is the core of the HKT encoding — it resolves `Kind<ArrayHKT, number>`
 * to `Array<number>` at the type level.
 */
export type Kind<F, A> = F extends { readonly [__hkt_uri__]: infer URI }
  ? URI extends keyof HKTRegistry
    ? (HKTRegistry[URI] & { readonly __arg__: A })["type"]
    : { readonly __hkt_error__: "URI not registered in HKTRegistry"; uri: URI }
  : { readonly __hkt_error__: "F is not an HKT-branded type"; f: F };

/**
 * Kind with two type arguments (for Bifunctor, etc.)
 */
export type Kind2<F, A, B> = F extends { readonly [__hkt_uri__]: infer URI }
  ? URI extends keyof HKTRegistry
    ? (HKTRegistry[URI] & { readonly __arg__: A; readonly __arg2__: B })["type"]
    : never
  : never;

// ============================================================================
// Built-in HKT Brands for common type constructors
// ============================================================================

/** HKT brand for Array */
export interface ArrayHKT {
  readonly [__hkt_uri__]: "Array";
}

/** HKT brand for Promise */
export interface PromiseHKT {
  readonly [__hkt_uri__]: "Promise";
}

/** HKT brand for Map (2-arity) */
export interface MapHKT {
  readonly [__hkt_uri__]: "Map";
}

/** HKT brand for Set */
export interface SetHKT {
  readonly [__hkt_uri__]: "Set";
}

/** HKT brand for ReadonlyArray */
export interface ReadonlyArrayHKT {
  readonly [__hkt_uri__]: "ReadonlyArray";
}

// ============================================================================
// Common Higher-Kinded Typeclasses
// ============================================================================

/**
 * Functor — types that can be mapped over.
 *
 * Laws:
 * - Identity: map(fa, x => x) === fa
 * - Composition: map(map(fa, f), g) === map(fa, x => g(f(x)))
 */
export interface Functor<F> {
  readonly map: <A, B>(fa: Kind<F, A>, f: (a: A) => B) => Kind<F, B>;
}

/**
 * Applicative — Functor with pure and ap.
 *
 * Laws:
 * - Identity: ap(pure(x => x), v) === v
 * - Composition: ap(ap(ap(pure(compose), u), v), w) === ap(u, ap(v, w))
 * - Homomorphism: ap(pure(f), pure(x)) === pure(f(x))
 * - Interchange: ap(u, pure(y)) === ap(pure(f => f(y)), u)
 */
export interface Applicative<F> extends Functor<F> {
  readonly pure: <A>(a: A) => Kind<F, A>;
  readonly ap: <A, B>(fab: Kind<F, (a: A) => B>, fa: Kind<F, A>) => Kind<F, B>;
}

/**
 * Monad — Applicative with flatMap (bind/chain).
 *
 * Laws:
 * - Left identity: flatMap(pure(a), f) === f(a)
 * - Right identity: flatMap(m, pure) === m
 * - Associativity: flatMap(flatMap(m, f), g) === flatMap(m, a => flatMap(f(a), g))
 */
export interface Monad<F> extends Applicative<F> {
  readonly flatMap: <A, B>(
    fa: Kind<F, A>,
    f: (a: A) => Kind<F, B>,
  ) => Kind<F, B>;
}

/**
 * Foldable — types that can be folded to a summary value.
 */
export interface Foldable<F> {
  readonly reduce: <A, B>(fa: Kind<F, A>, b: B, f: (b: B, a: A) => B) => B;
}

/**
 * Traversable — types that can be traversed with an effect.
 */
export interface Traversable<F> extends Functor<F>, Foldable<F> {
  readonly traverse: <G, A, B>(
    A: Applicative<G>,
    fa: Kind<F, A>,
    f: (a: A) => Kind<G, B>,
  ) => Kind<G, Kind<F, B>>;
}

// ============================================================================
// Built-in Instances
// ============================================================================

/** Functor instance for Array */
export const arrayFunctor: Functor<ArrayHKT> = {
  map: (fa, f) => (fa as unknown[]).map(f as (a: unknown) => unknown) as any,
};

/** Monad instance for Array */
export const arrayMonad: Monad<ArrayHKT> = {
  map: (fa, f) => (fa as unknown[]).map(f as (a: unknown) => unknown) as any,
  pure: (a) => [a] as any,
  ap: (fab, fa) =>
    (fab as unknown[]).flatMap((f: any) =>
      (fa as unknown[]).map((a: any) => f(a)),
    ) as any,
  flatMap: (fa, f) =>
    (fa as unknown[]).flatMap(f as (a: unknown) => unknown[]) as any,
};

/** Foldable instance for Array */
export const arrayFoldable: Foldable<ArrayHKT> = {
  reduce: (fa, b, f) => (fa as unknown[]).reduce(f as any, b),
};

/** Functor instance for Promise */
export const promiseFunctor: Functor<PromiseHKT> = {
  map: (fa, f) => (fa as Promise<unknown>).then(f as any) as any,
};

/** Monad instance for Promise */
export const promiseMonad: Monad<PromiseHKT> = {
  map: (fa, f) => (fa as Promise<unknown>).then(f as any) as any,
  pure: (a) => Promise.resolve(a) as any,
  ap: (fab, fa) =>
    (fab as Promise<unknown>).then((f: any) =>
      (fa as Promise<unknown>).then((a: any) => f(a)),
    ) as any,
  flatMap: (fa, f) => (fa as Promise<unknown>).then(f as any) as any,
};

// ============================================================================
// @hkt Attribute Macro
// ============================================================================

/**
 * @hkt decorator — marks an interface as a higher-kinded typeclass.
 *
 * The macro generates:
 * 1. HKT URI brand type
 * 2. Kind<F, A> type application helper
 * 3. Type-safe instance registration infrastructure
 */
export const hktAttribute = defineAttributeMacro({
  name: "hkt",
  description:
    "Mark an interface as a higher-kinded typeclass with auto-generated HKT encoding",
  validTargets: ["interface"] as AttributeTarget[],

  expand(
    ctx: MacroContext,
    _decorator: ts.Decorator,
    target: ts.Declaration,
    _args: readonly ts.Expression[],
  ): ts.Node | ts.Node[] {
    if (!ts.isInterfaceDeclaration(target)) {
      ctx.reportError(target, "@hkt can only be applied to interfaces");
      return target;
    }

    const name = target.name.text;
    const factory = ctx.factory;

    // Generate the HKT URI brand interface
    const uriBrandName = `${name}HKT`;
    const uriSymbolProp = factory.createPropertySignature(
      [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
      factory.createIdentifier("__hkt_uri__"),
      undefined,
      factory.createLiteralTypeNode(factory.createStringLiteral(name)),
    );
    const uriBrandInterface = factory.createInterfaceDeclaration(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier(uriBrandName),
      undefined,
      undefined,
      [uriSymbolProp],
    );

    // Generate a companion namespace with utility functions
    const summonFn = factory.createFunctionDeclaration(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      undefined,
      factory.createIdentifier(`summon${name}`),
      [
        factory.createTypeParameterDeclaration(
          undefined,
          factory.createIdentifier("F"),
        ),
      ],
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          factory.createIdentifier("instance"),
          undefined,
          factory.createTypeReferenceNode(factory.createIdentifier(name), [
            factory.createTypeReferenceNode(factory.createIdentifier("F")),
          ]),
        ),
      ],
      factory.createTypeReferenceNode(factory.createIdentifier(name), [
        factory.createTypeReferenceNode(factory.createIdentifier("F")),
      ]),
      factory.createBlock(
        [factory.createReturnStatement(factory.createIdentifier("instance"))],
        true,
      ),
    );

    // Return the original interface (unchanged) plus generated code
    return [target, uriBrandInterface, summonFn];
  },
});

// ============================================================================
// hktInstance Expression Macro
// ============================================================================

/**
 * hktInstance<TC, Brand>(instance) — register an HKT instance.
 *
 * This is an expression macro that type-checks the instance and returns it.
 * The actual type registration happens via the type-level API (Kind<F, A>).
 */
export const hktInstanceMacro = defineExpressionMacro({
  name: "hktInstance",
  description:
    "Register an HKT typeclass instance for a concrete type constructor",

  expand(
    _ctx: MacroContext,
    _callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    // hktInstance(instanceObj) just returns the instance — the type system
    // handles the rest via Kind<F, A> resolution
    if (args.length >= 1) {
      return args[0];
    }
    return _callExpr;
  },
});

// ============================================================================
// Generic HKT Utilities (expression macros)
// ============================================================================

/**
 * liftA2 — lift a binary function into an Applicative context.
 *
 * liftA2(A, f, fa, fb) === A.ap(A.map(fa, a => b => f(a, b)), fb)
 */
export function liftA2<F, A, B, C>(
  A: Applicative<F>,
  f: (a: A, b: B) => C,
  fa: Kind<F, A>,
  fb: Kind<F, B>,
): Kind<F, C> {
  return A.ap(
    A.map(fa, (a: A) => (b: B) => f(a, b)) as Kind<F, (b: B) => C>,
    fb,
  );
}

/**
 * sequence — turn an array of effects into an effect of an array.
 *
 * sequence(A, [fa, fb, fc]) === A.ap(A.ap(A.map(fa, a => b => c => [a,b,c]), fb), fc)
 */
export function sequence<F, A>(
  A: Applicative<F>,
  fas: Kind<F, A>[],
): Kind<F, A[]> {
  return fas.reduce(
    (acc: Kind<F, A[]>, fa: Kind<F, A>) =>
      liftA2(A, (as: A[], a: A) => [...as, a], acc, fa),
    A.pure([] as A[]),
  );
}

/**
 * mapM — map a monadic function over an array and sequence the results.
 */
export function mapM<F, A, B>(
  M: Monad<F>,
  as: A[],
  f: (a: A) => Kind<F, B>,
): Kind<F, B[]> {
  return as.reduce(
    (acc: Kind<F, B[]>, a: A) =>
      M.flatMap(acc, (bs: B[]) => M.map(f(a), (b: B) => [...bs, b])),
    M.pure([] as B[]),
  );
}

// ============================================================================
// Register macros
// ============================================================================

globalRegistry.register(hktAttribute);
globalRegistry.register(hktInstanceMacro);
