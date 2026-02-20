/**
 * @module @typesugar/validate
 * Zero-cost validation and schema macros for typesugar.
 */

export declare function is<T>(): (value: unknown) => value is T;
export declare function assert<T>(): (value: unknown) => T;
export declare function validate<T>(): (
  value: unknown,
) => import("@typesugar/fp").ValidatedNel<import("./types").ValidationError, T>;

export * from "./types";

// Register macros if this file is imported in a compiler context
import { globalRegistry } from "@typesugar/core";
try {
  // Use dynamic import so it doesn't fail in pure runtime environments
  // where the compiler API isn't present, but still registers in the transformer
  import("./macros.js")
    .then((m) => {
      m.register(globalRegistry);
    })
    .catch(() => {});
} catch (e) {
  // Runtime environment, ignore
}
