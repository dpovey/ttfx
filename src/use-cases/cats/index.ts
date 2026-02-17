/**
 * Cats FP System for TypeScript
 *
 * A complete functional programming system modeled after Cats in Scala.
 *
 * Features:
 * - Complete typeclass hierarchy (Functor, Monad, Applicative, etc.)
 * - Core data types (Option, Either, List, Validated)
 * - Monad transformers (State, Reader, Writer)
 * - IO monad with stack-safe interpreter
 * - IO runtime utilities (Ref, Deferred, Resource)
 * - Do-comprehension support
 * - Pipe/flow composition helpers
 *
 * @example
 * ```typescript
 * import {
 *   Option, Some, None,
 *   Either, Left, Right,
 *   IO, runIO,
 *   pipe, flow
 * } from './cats';
 *
 * // Option example
 * const result = Option.flatMap(Some(2), x => Some(x * 3));
 *
 * // Either example
 * const validated = Either.map(Right(42), x => x.toString());
 *
 * // IO example
 * const program = IO.flatMap(
 *   IO.delay(() => "Hello"),
 *   msg => IO.delay(() => console.log(msg))
 * );
 * await runIO(program);
 *
 * // Pipe example
 * const transformed = pipe(
 *   5,
 *   x => x * 2,
 *   x => x + 1,
 *   x => x.toString()
 * );
 * ```
 */

// ============================================================================
// HKT Foundation
// ============================================================================

export * from "./hkt";

// ============================================================================
// Typeclasses
// ============================================================================

export * from "./typeclasses";

// ============================================================================
// Data Types
// ============================================================================

export * from "./data";

// ============================================================================
// IO & Runtime
// ============================================================================

export * from "./io";

// ============================================================================
// Syntax Utilities
// ============================================================================

export * from "./syntax";

// ============================================================================
// Re-export key types for convenience
// ============================================================================

// Option
export { Option, Some, None, isSome, isNone } from "./data/option";

// Either
export { Either, Left, Right, isLeft, isRight } from "./data/either";

// List
export { List, Cons, Nil } from "./data/list";

// NonEmptyList
export { NonEmptyList } from "./data/nonempty-list";

// Validated
export {
  Validated,
  Valid,
  Invalid,
  ValidatedNel,
  valid,
  invalid,
  validNel,
  invalidNel,
  isValid,
  isInvalid,
} from "./data/validated";

// State, Reader, Writer, Id
export { State, IndexedState } from "./data/state";
export { Reader, Kleisli } from "./data/reader";
export {
  Writer,
  LogWriter,
  LogWriterMonoid,
  SumWriter,
  SumWriterMonoid,
} from "./data/writer";
export { Id } from "./data/id";

// IO
export { IO, runIO, runIOSync, unsafeRunIO, IODo, io, IOFluent } from "./io/io";

// IO Runtime
export {
  IOApp,
  ExitSuccess,
  ExitFailure,
  runIOApp,
  ioApp,
  getEnv,
  requireEnv,
} from "./io/io-app";
export { Resource, FileHandle, pool } from "./io/resource";
export { Ref, Counter, AtomicBoolean, Semaphore, Queue } from "./io/ref";
export {
  Deferred,
  TryableDeferred,
  MVar,
  CountDownLatch,
  CyclicBarrier,
} from "./io/deferred";
export { Console, ConsoleDo } from "./io/console";

// Syntax
export {
  pipe,
  flow,
  compose,
  identity,
  constant,
  always,
  thunk,
  flip,
  curry,
  uncurry,
  curry3,
  uncurry3,
  apply,
  applyTo,
  tap,
  tapIf,
  not,
  and,
  or,
  tuple,
  fst,
  snd,
  swap,
  mapFst,
  mapSnd,
  bimap,
  Lazy,
  lazy,
  memoize,
  memoize1,
  memoizeWith,
  trace,
  timed,
  assert,
} from "./syntax/pipe";

export {
  Do,
  DoBuilder,
  OptionDo,
  OptionFor,
  EitherDo,
  EitherFor,
  IODo as IODoSyntax,
  IOFor,
  For,
  chain,
  optionCE,
  asyncDo,
  yieldAsync,
} from "./syntax/do";
