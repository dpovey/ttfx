/**
 * Data Types Index
 *
 * Re-exports all data types for the Cats FP system.
 * Uses namespace exports to avoid name collisions between modules
 * (Option, Either, List, etc. all export common names like map, flatMap, etc.)
 */

// Core data types - namespace exports to avoid collisions
export * as Option from "./option.js";
export * as Either from "./either.js";
export * as List from "./list.js";
export * as NonEmptyList from "./nonempty-list.js";
export * as Validated from "./validated.js";

// Monad transformers / effect types
export * as State from "./state.js";
export * as Reader from "./reader.js";
export * as Writer from "./writer.js";
export * as Id from "./id.js";

// Also export the core type constructors directly for convenience
export {
  None,
  Some,
  type Option as OptionType,
  isSome,
  isNone,
} from "./option.js";
export {
  Left,
  Right,
  type Either as EitherType,
  isLeft,
  isRight,
} from "./either.js";
export { Nil, Cons, type List as ListType } from "./list.js";
