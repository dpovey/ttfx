/**
 * Rounding - Rounding modes and utilities for fixed-precision arithmetic
 *
 * Provides comprehensive rounding support for financial and scientific calculations.
 *
 * @example
 * ```typescript
 * import { RoundingMode, roundBigInt } from "@typesugar/math";
 *
 * // Round 250 (representing 2.50) to 1 decimal place
 * roundBigInt(250n, 1, 2, "HALF_EVEN"); // 200n (2.0)
 * roundBigInt(350n, 1, 2, "HALF_EVEN"); // 400n (4.0 - round to even)
 * ```
 */

/**
 * Standard rounding modes for decimal arithmetic.
 *
 * | Mode | Description | Example (→ integer) |
 * |------|-------------|---------------------|
 * | HALF_UP | Round away from zero at 0.5 | 2.5→3, -2.5→-3 |
 * | HALF_DOWN | Round toward zero at 0.5 | 2.5→2, -2.5→-2 |
 * | HALF_EVEN | Round to nearest even at 0.5 (banker's rounding) | 2.5→2, 3.5→4 |
 * | CEIL | Round toward +∞ | 2.1→3, -2.1→-2 |
 * | FLOOR | Round toward -∞ | 2.9→2, -2.9→-3 |
 * | TRUNC | Round toward zero | 2.9→2, -2.9→-2 |
 * | HALF_CEIL | Round toward +∞ at 0.5 | 2.5→3, -2.5→-2 |
 * | HALF_FLOOR | Round toward -∞ at 0.5 | 2.5→2, -2.5→-3 |
 */
export type RoundingMode =
  | "HALF_UP"
  | "HALF_DOWN"
  | "HALF_EVEN"
  | "CEIL"
  | "FLOOR"
  | "TRUNC"
  | "HALF_CEIL"
  | "HALF_FLOOR";

/**
 * Default rounding mode: banker's rounding (HALF_EVEN).
 * This minimizes cumulative rounding error over many operations.
 */
export const DEFAULT_ROUNDING_MODE: RoundingMode = "HALF_EVEN";

/**
 * Round a bigint value from one scale to another.
 *
 * @param value - The unscaled bigint value
 * @param toScale - Target number of decimal places
 * @param fromScale - Current number of decimal places
 * @param mode - Rounding mode to apply
 * @returns Rounded bigint at the target scale
 *
 * @example
 * ```typescript
 * // 12345 at scale 3 = 12.345, round to scale 2 = 12.35
 * roundBigInt(12345n, 2, 3, "HALF_UP"); // 1235n (12.35)
 * ```
 */
export function roundBigInt(
  value: bigint,
  toScale: number,
  fromScale: number,
  mode: RoundingMode = DEFAULT_ROUNDING_MODE
): bigint {
  if (toScale >= fromScale) {
    // No rounding needed, possibly scaling up
    const scaleDiff = toScale - fromScale;
    return scaleDiff > 0 ? value * 10n ** BigInt(scaleDiff) : value;
  }

  const scaleDiff = fromScale - toScale;
  const divisor = 10n ** BigInt(scaleDiff);
  let quotient = value / divisor;
  const remainder = value % divisor;

  if (remainder === 0n) {
    return quotient;
  }

  const negative = value < 0n;
  const absRemainder = remainder < 0n ? -remainder : remainder;
  const halfDivisor = divisor / 2n;
  const isExactlyHalf = absRemainder === halfDivisor && divisor % 2n === 0n;
  const moreThanHalf = absRemainder > halfDivisor;

  switch (mode) {
    case "CEIL":
      // Round toward +∞
      if (!negative && remainder !== 0n) {
        quotient += 1n;
      }
      break;

    case "FLOOR":
      // Round toward -∞
      if (negative && remainder !== 0n) {
        quotient -= 1n;
      }
      break;

    case "TRUNC":
      // Round toward zero (already done by integer division)
      break;

    case "HALF_UP":
      // Round away from zero at exactly 0.5
      if (moreThanHalf || isExactlyHalf) {
        quotient += negative ? -1n : 1n;
      }
      break;

    case "HALF_DOWN":
      // Round toward zero at exactly 0.5
      if (moreThanHalf) {
        quotient += negative ? -1n : 1n;
      }
      break;

    case "HALF_EVEN":
      // Banker's rounding: round to nearest even at exactly 0.5
      if (moreThanHalf) {
        quotient += negative ? -1n : 1n;
      } else if (isExactlyHalf) {
        // Round to even
        const absQuotient = quotient < 0n ? -quotient : quotient;
        if (absQuotient % 2n !== 0n) {
          quotient += negative ? -1n : 1n;
        }
      }
      break;

    case "HALF_CEIL":
      // Round toward +∞ at exactly 0.5
      if (moreThanHalf || (isExactlyHalf && !negative)) {
        quotient += 1n;
      } else if (moreThanHalf && negative) {
        quotient -= 1n;
      }
      break;

    case "HALF_FLOOR":
      // Round toward -∞ at exactly 0.5
      if (moreThanHalf) {
        quotient += negative ? -1n : 1n;
      } else if (isExactlyHalf && negative) {
        quotient -= 1n;
      }
      break;
  }

  return quotient;
}

/**
 * Round a number to a specified number of decimal places.
 *
 * @param value - The number to round
 * @param places - Number of decimal places
 * @param mode - Rounding mode to apply
 * @returns Rounded number
 *
 * @example
 * ```typescript
 * roundNumber(2.555, 2, "HALF_UP");  // 2.56
 * roundNumber(2.555, 2, "HALF_EVEN"); // 2.56 (5 is odd, round up)
 * roundNumber(2.545, 2, "HALF_EVEN"); // 2.54 (4 is even, round down)
 * ```
 */
export function roundNumber(
  value: number,
  places: number,
  mode: RoundingMode = DEFAULT_ROUNDING_MODE
): number {
  if (!Number.isFinite(value)) {
    return value;
  }

  const factor = Math.pow(10, places);
  const scaled = value * factor;

  switch (mode) {
    case "CEIL":
      return Math.ceil(scaled) / factor;

    case "FLOOR":
      return Math.floor(scaled) / factor;

    case "TRUNC":
      return Math.trunc(scaled) / factor;

    case "HALF_UP": {
      // Math.round rounds away from zero for positive, but we need consistency
      const sign = value < 0 ? -1 : 1;
      return (sign * Math.round(Math.abs(scaled))) / factor;
    }

    case "HALF_DOWN": {
      const intPart = Math.trunc(scaled);
      const fracPart = Math.abs(scaled - intPart);
      if (fracPart <= 0.5) {
        return intPart / factor;
      }
      return (intPart + (scaled > 0 ? 1 : -1)) / factor;
    }

    case "HALF_EVEN": {
      const intPart = Math.trunc(scaled);
      const fracPart = Math.abs(scaled - intPart);
      if (fracPart < 0.5) {
        return intPart / factor;
      }
      if (fracPart > 0.5) {
        return (intPart + (scaled > 0 ? 1 : -1)) / factor;
      }
      // Exactly 0.5: round to even
      const absInt = Math.abs(intPart);
      if (absInt % 2 === 0) {
        return intPart / factor;
      }
      return (intPart + (scaled > 0 ? 1 : -1)) / factor;
    }

    case "HALF_CEIL": {
      const intPart = Math.trunc(scaled);
      const fracPart = scaled - intPart;
      if (fracPart >= 0.5) {
        return (intPart + 1) / factor;
      }
      if (fracPart <= -0.5) {
        return intPart / factor;
      }
      return intPart / factor;
    }

    case "HALF_FLOOR": {
      const intPart = Math.trunc(scaled);
      const fracPart = scaled - intPart;
      if (fracPart <= -0.5) {
        return (intPart - 1) / factor;
      }
      if (fracPart > 0.5) {
        return (intPart + 1) / factor;
      }
      return intPart / factor;
    }
  }
}

/**
 * Check if a rounding mode is valid.
 */
export function isValidRoundingMode(mode: string): mode is RoundingMode {
  return [
    "HALF_UP",
    "HALF_DOWN",
    "HALF_EVEN",
    "CEIL",
    "FLOOR",
    "TRUNC",
    "HALF_CEIL",
    "HALF_FLOOR",
  ].includes(mode);
}
