/**
 * Typeclasses - Cats-style typeclass hierarchy
 *
 * This module exports all typeclasses and their derived operations.
 */

// Functor hierarchy
export * from "./functor.js";
export * from "./applicative.js";
export * from "./monad.js";
export * from "./monad-error.js";

// Foldable/Traverse
export * from "./foldable.js";
export * from "./traverse.js";

// Algebraic structures
export * from "./semigroup.js";
export * from "./eq.js";
export * from "./show.js";

// Semigroupal
export * from "./semigroupal.js";

// Alternative
export * from "./alternative.js";
