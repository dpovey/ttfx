/**
 * Type-Safe Units Library
 *
 * A compile-time unit system inspired by boost::units.
 * Provides type-safe arithmetic operations that verify unit compatibility
 * at compile time.
 *
 * @example
 * ```typescript
 * import { meters, seconds, kilograms } from "typemacro/units";
 *
 * const distance = meters(100);
 * const time = seconds(10);
 * const velocity = distance.div(time); // Type: Unit<Velocity>
 *
 * // Compile error: can't add meters and seconds
 * // const invalid = distance.add(time);
 *
 * // Using the units macro:
 * const speed = units`100 km/h`;  // Parsed at compile time
 * ```
 */

export * from "./types.js";
export * from "./macro.js";
