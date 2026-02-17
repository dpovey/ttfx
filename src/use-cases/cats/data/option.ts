/**
 * Option Data Type
 *
 * Option represents an optional value: every Option<A> is either Some(a) or None.
 * This is a safer alternative to null/undefined.
 */

import type { Eq, Ord, Ordering } from "../typeclasses/eq.js";
import type { Show } from "../typeclasses/show.js";
import type { Semigroup, Monoid } from "../typeclasses/semigroup.js";

// ============================================================================
// Option Type Definition
// ============================================================================

/**
 * Option data type - either Some(value) or None
 */
export type Option<A> = Some<A> | None;

/**
 * Some variant - contains a value
 */
export interface Some<A> {
  readonly _tag: "Some";
  readonly value: A;
}

/**
 * None variant - represents absence of value
 */
export interface None {
  readonly _tag: "None";
}

// ============================================================================
// Constructors
// ============================================================================

/**
 * Create a Some value
 */
export function Some<A>(value: A): Option<A> {
  return { _tag: "Some", value };
}

/**
 * The None value (singleton)
 */
export const None: Option<never> = { _tag: "None" };

/**
 * Create an Option from a nullable value
 */
export function fromNullable<A>(value: A | null | undefined): Option<A> {
  return value == null ? None : Some(value);
}

/**
 * Create an Option from a predicate
 */
export function fromPredicate<A>(
  value: A,
  predicate: (a: A) => boolean,
): Option<A> {
  return predicate(value) ? Some(value) : None;
}

/**
 * Create an Option from a try/catch
 */
export function tryCatch<A>(f: () => A): Option<A> {
  try {
    return Some(f());
  } catch {
    return None;
  }
}

/**
 * Create Some(a) if defined, None otherwise
 */
export function of<A>(a: A): Option<A> {
  return Some(a);
}

/**
 * Create None
 */
export function none<A = never>(): Option<A> {
  return None;
}

/**
 * Create Some(a)
 */
export function some<A>(a: A): Option<A> {
  return Some(a);
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if Option is Some
 */
export function isSome<A>(opt: Option<A>): opt is Some<A> {
  return opt._tag === "Some";
}

/**
 * Check if Option is None
 */
export function isNone<A>(opt: Option<A>): opt is None {
  return opt._tag === "None";
}

// ============================================================================
// Operations
// ============================================================================

/**
 * Map over the Option value
 */
export function map<A, B>(opt: Option<A>, f: (a: A) => B): Option<B> {
  return isSome(opt) ? Some(f(opt.value)) : None;
}

/**
 * FlatMap over the Option value
 */
export function flatMap<A, B>(
  opt: Option<A>,
  f: (a: A) => Option<B>,
): Option<B> {
  return isSome(opt) ? f(opt.value) : None;
}

/**
 * Apply a function in Option to a value in Option
 */
export function ap<A, B>(
  optF: Option<(a: A) => B>,
  optA: Option<A>,
): Option<B> {
  return flatMap(optF, (f) => map(optA, f));
}

/**
 * Fold over Option - provide handlers for both cases
 */
export function fold<A, B>(
  opt: Option<A>,
  onNone: () => B,
  onSome: (a: A) => B,
): B {
  return isSome(opt) ? onSome(opt.value) : onNone();
}

/**
 * Match over Option (alias for fold with object syntax)
 */
export function match<A, B>(
  opt: Option<A>,
  patterns: { None: () => B; Some: (a: A) => B },
): B {
  return isSome(opt) ? patterns.Some(opt.value) : patterns.None();
}

/**
 * Get the value or a default
 */
export function getOrElse<A>(opt: Option<A>, defaultValue: () => A): A {
  return isSome(opt) ? opt.value : defaultValue();
}

/**
 * Get the value or a default (strict version)
 */
export function getOrElseStrict<A>(opt: Option<A>, defaultValue: A): A {
  return isSome(opt) ? opt.value : defaultValue;
}

/**
 * Get the value or throw
 */
export function getOrThrow<A>(opt: Option<A>, message?: string): A {
  if (isSome(opt)) return opt.value;
  throw new Error(message ?? "Called getOrThrow on None");
}

/**
 * Return the first Some, or evaluate the fallback
 */
export function orElse<A>(
  opt: Option<A>,
  fallback: () => Option<A>,
): Option<A> {
  return isSome(opt) ? opt : fallback();
}

/**
 * Filter the Option value
 */
export function filter<A>(
  opt: Option<A>,
  predicate: (a: A) => boolean,
): Option<A> {
  return isSome(opt) && predicate(opt.value) ? opt : None;
}

/**
 * Filter the Option value (inverted)
 */
export function filterNot<A>(
  opt: Option<A>,
  predicate: (a: A) => boolean,
): Option<A> {
  return filter(opt, (a) => !predicate(a));
}

/**
 * Check if the value satisfies a predicate
 */
export function exists<A>(
  opt: Option<A>,
  predicate: (a: A) => boolean,
): boolean {
  return isSome(opt) && predicate(opt.value);
}

/**
 * Check if all values satisfy a predicate (vacuously true for None)
 */
export function forall<A>(
  opt: Option<A>,
  predicate: (a: A) => boolean,
): boolean {
  return isNone(opt) || predicate(opt.value);
}

/**
 * Check if the Option contains a specific value
 */
export function contains<A>(
  opt: Option<A>,
  value: A,
  eq: (a: A, b: A) => boolean = (a, b) => a === b,
): boolean {
  return isSome(opt) && eq(opt.value, value);
}

/**
 * Convert Option to Either
 */
export function toEither<E, A>(opt: Option<A>, left: () => E): Either<E, A> {
  return isSome(opt) ? Right(opt.value) : Left(left());
}

// Simple Either for toEither
type Either<E, A> =
  | { readonly _tag: "Left"; readonly left: E }
  | { readonly _tag: "Right"; readonly right: A };
const Left = <E, A>(left: E): Either<E, A> => ({ _tag: "Left", left });
const Right = <E, A>(right: A): Either<E, A> => ({ _tag: "Right", right });

/**
 * Convert Option to array
 */
export function toArray<A>(opt: Option<A>): A[] {
  return isSome(opt) ? [opt.value] : [];
}

/**
 * Convert Option to nullable
 */
export function toNullable<A>(opt: Option<A>): A | null {
  return isSome(opt) ? opt.value : null;
}

/**
 * Convert Option to undefined
 */
export function toUndefined<A>(opt: Option<A>): A | undefined {
  return isSome(opt) ? opt.value : undefined;
}

/**
 * Zip two Options
 */
export function zip<A, B>(optA: Option<A>, optB: Option<B>): Option<[A, B]> {
  return flatMap(optA, (a) => map(optB, (b) => [a, b] as [A, B]));
}

/**
 * Zip with a function
 */
export function zipWith<A, B, C>(
  optA: Option<A>,
  optB: Option<B>,
  f: (a: A, b: B) => C,
): Option<C> {
  return flatMap(optA, (a) => map(optB, (b) => f(a, b)));
}

/**
 * Unzip an Option of tuple
 */
export function unzip<A, B>(opt: Option<[A, B]>): [Option<A>, Option<B>] {
  return isSome(opt) ? [Some(opt.value[0]), Some(opt.value[1])] : [None, None];
}

/**
 * Flatten a nested Option
 */
export function flatten<A>(opt: Option<Option<A>>): Option<A> {
  return flatMap(opt, (inner) => inner);
}

/**
 * Tap - perform a side effect and return the original Option
 */
export function tap<A>(opt: Option<A>, f: (a: A) => void): Option<A> {
  if (isSome(opt)) {
    f(opt.value);
  }
  return opt;
}

/**
 * Traverse with a function that returns an Option
 */
export function traverse<A, B>(arr: A[], f: (a: A) => Option<B>): Option<B[]> {
  const results: B[] = [];
  for (const a of arr) {
    const opt = f(a);
    if (isNone(opt)) return None;
    results.push(opt.value);
  }
  return Some(results);
}

/**
 * Sequence an array of Options
 */
export function sequence<A>(opts: Option<A>[]): Option<A[]> {
  return traverse(opts, (opt) => opt);
}

/**
 * Check if Option is defined (has value)
 */
export function isDefined<A>(opt: Option<A>): boolean {
  return isSome(opt);
}

/**
 * Check if Option is empty
 */
export function isEmpty<A>(opt: Option<A>): boolean {
  return isNone(opt);
}

// ============================================================================
// Typeclass Instances
// ============================================================================

/**
 * Eq instance for Option
 */
export function getEq<A>(E: Eq<A>): Eq<Option<A>> {
  return {
    eqv: (x, y) => {
      if (isNone(x) && isNone(y)) return true;
      if (isSome(x) && isSome(y)) return E.eqv(x.value, y.value);
      return false;
    },
  };
}

/**
 * Ord instance for Option (None < Some)
 */
export function getOrd<A>(O: Ord<A>): Ord<Option<A>> {
  return {
    eqv: getEq(O).eqv,
    compare: (x, y) => {
      if (isNone(x) && isNone(y)) return 0 as Ordering;
      if (isNone(x)) return -1 as Ordering;
      if (isNone(y)) return 1 as Ordering;
      return O.compare(x.value, y.value);
    },
  };
}

/**
 * Show instance for Option
 */
export function getShow<A>(S: Show<A>): Show<Option<A>> {
  return {
    show: (opt) => (isSome(opt) ? `Some(${S.show(opt.value)})` : "None"),
  };
}

/**
 * Semigroup instance for Option (combines inner values)
 */
export function getSemigroup<A>(S: Semigroup<A>): Semigroup<Option<A>> {
  return {
    combine: (x, y) => {
      if (isNone(x)) return y;
      if (isNone(y)) return x;
      return Some(S.combine(x.value, y.value));
    },
  };
}

/**
 * Monoid instance for Option
 */
export function getMonoid<A>(S: Semigroup<A>): Monoid<Option<A>> {
  return {
    ...getSemigroup(S),
    empty: None,
  };
}

/**
 * Alternative monoid - first Some wins
 */
export function getFirstMonoid<A>(): Monoid<Option<A>> {
  return {
    combine: (x, y) => (isSome(x) ? x : y),
    empty: None,
  };
}

/**
 * Alternative monoid - last Some wins
 */
export function getLastMonoid<A>(): Monoid<Option<A>> {
  return {
    combine: (x, y) => (isSome(y) ? y : x),
    empty: None,
  };
}

// ============================================================================
// Do-notation Support
// ============================================================================

/**
 * Start a do-comprehension with Option
 */
export const Do: Option<{}> = Some({});

/**
 * Bind a value in do-notation style
 */
export function bind<N extends string, A extends object, B>(
  name: Exclude<N, keyof A>,
  f: (a: A) => Option<B>,
): (opt: Option<A>) => Option<A & { readonly [K in N]: B }> {
  return (opt) =>
    flatMap(opt, (a) =>
      map(f(a), (b) => ({ ...a, [name]: b }) as A & { readonly [K in N]: B }),
    );
}

/**
 * Let - bind a non-effectful value
 */
export function let_<N extends string, A extends object, B>(
  name: Exclude<N, keyof A>,
  f: (a: A) => B,
): (opt: Option<A>) => Option<A & { readonly [K in N]: B }> {
  return (opt) =>
    map(opt, (a) => ({ ...a, [name]: f(a) }) as A & { readonly [K in N]: B });
}

// ============================================================================
// Fluent API (Option class)
// ============================================================================

/**
 * Option with fluent methods
 */
export class OptionImpl<A> {
  private constructor(private readonly opt: Option<A>) {}

  static some<A>(value: A): OptionImpl<A> {
    return new OptionImpl(Some(value));
  }

  static none<A>(): OptionImpl<A> {
    return new OptionImpl(None as Option<A>);
  }

  static fromNullable<A>(value: A | null | undefined): OptionImpl<A> {
    return new OptionImpl(fromNullable(value));
  }

  static fromPredicate<A>(
    value: A,
    predicate: (a: A) => boolean,
  ): OptionImpl<A> {
    return new OptionImpl(fromPredicate(value, predicate));
  }

  get value(): Option<A> {
    return this.opt;
  }

  isSome(): boolean {
    return isSome(this.opt);
  }

  isNone(): boolean {
    return isNone(this.opt);
  }

  map<B>(f: (a: A) => B): OptionImpl<B> {
    return new OptionImpl(map(this.opt, f));
  }

  flatMap<B>(f: (a: A) => Option<B>): OptionImpl<B> {
    return new OptionImpl(flatMap(this.opt, f));
  }

  chain<B>(f: (a: A) => OptionImpl<B>): OptionImpl<B> {
    return new OptionImpl(flatMap(this.opt, (a) => f(a).value));
  }

  ap<B>(this: OptionImpl<(a: A) => B>, optA: OptionImpl<A>): OptionImpl<B> {
    return new OptionImpl(
      ap(
        this.opt as Option<(a: unknown) => B>,
        optA.opt as Option<unknown>,
      ) as Option<B>,
    );
  }

  fold<B>(onNone: () => B, onSome: (a: A) => B): B {
    return fold(this.opt, onNone, onSome);
  }

  getOrElse(defaultValue: () => A): A {
    return getOrElse(this.opt, defaultValue);
  }

  getOrElseValue(defaultValue: A): A {
    return getOrElseStrict(this.opt, defaultValue);
  }

  getOrThrow(message?: string): A {
    return getOrThrow(this.opt, message);
  }

  orElse(fallback: () => Option<A>): OptionImpl<A> {
    return new OptionImpl(orElse(this.opt, fallback));
  }

  filter(predicate: (a: A) => boolean): OptionImpl<A> {
    return new OptionImpl(filter(this.opt, predicate));
  }

  filterNot(predicate: (a: A) => boolean): OptionImpl<A> {
    return new OptionImpl(filterNot(this.opt, predicate));
  }

  exists(predicate: (a: A) => boolean): boolean {
    return exists(this.opt, predicate);
  }

  forall(predicate: (a: A) => boolean): boolean {
    return forall(this.opt, predicate);
  }

  contains(value: A): boolean {
    return contains(this.opt, value);
  }

  toArray(): A[] {
    return toArray(this.opt);
  }

  toNullable(): A | null {
    return toNullable(this.opt);
  }

  toUndefined(): A | undefined {
    return toUndefined(this.opt);
  }

  zip<B>(other: OptionImpl<B>): OptionImpl<[A, B]> {
    return new OptionImpl(zip(this.opt, other.opt));
  }

  tap(f: (a: A) => void): OptionImpl<A> {
    return new OptionImpl(tap(this.opt, f));
  }
}
