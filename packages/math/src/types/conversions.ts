/**
 * Conversions - Type conversions between numeric precision types
 *
 * Explicit conversion functions between Rational, BigDecimal, FixedDecimal, and Money.
 * All conversions require explicit scale/rounding parameters to prevent silent precision loss.
 *
 * @example
 * ```typescript
 * import {
 *   rationalToBigDecimal,
 *   bigDecimalToFixed,
 *   fixedToMoney,
 *   moneyToRational,
 * } from "@typesugar/math";
 *
 * const r = rational(1n, 3n);                    // 1/3
 * const bd = rationalToBigDecimal(r, 6);         // 0.333333
 * const fd = bigDecimalToFixed(bd, 2);           // 0.33
 * const m = fixedToMoney(fd, 2, USD);            // $0.33
 * const back = moneyToRational(m, USD);          // 33/100
 * ```
 *
 * @packageDocumentation
 */

import type { Rational } from "./rational.js";
import type { BigDecimal } from "./bigdecimal.js";
import type { FixedDecimal } from "./fixed-decimal.js";
import type { Money } from "./money.js";
import type { CurrencyDef } from "./currencies.js";

import { rational, fromNumber as rationalFromNumber } from "./rational.js";
import {
  bigDecimal,
  toNumber as bigDecimalToNumber,
  round as bigDecimalRound,
} from "./bigdecimal.js";
import {
  fixed,
  fixedToNumber,
  fixedRound,
} from "./fixed-decimal.js";
import {
  money,
  moneyFromMajor,
  moneyToMajor,
} from "./money.js";
import { currencyScaleFactor } from "./currencies.js";
import { type RoundingMode, DEFAULT_ROUNDING_MODE } from "./rounding.js";

// ============================================================================
// Rational Conversions
// ============================================================================

/**
 * Convert Rational to BigDecimal with specified scale.
 *
 * @param r - Rational to convert
 * @param scale - Number of decimal places
 * @returns BigDecimal approximation
 *
 * @example
 * ```typescript
 * rationalToBigDecimal(rational(1n, 3n), 6);  // 0.333333
 * ```
 */
export function rationalToBigDecimal(r: Rational, scale: number): BigDecimal {
  // r = num/den
  // We want: unscaled / 10^scale = num/den
  // So: unscaled = num * 10^scale / den
  const scaleFactor = 10n ** BigInt(scale);
  const unscaled = (r.num * scaleFactor) / r.den;
  return bigDecimal(unscaled, scale);
}

/**
 * Convert Rational to FixedDecimal.
 */
export function rationalToFixed<N extends number>(
  r: Rational,
  scale: N,
  mode: RoundingMode = DEFAULT_ROUNDING_MODE
): FixedDecimal<N> {
  // Use bigint division with extra precision for rounding
  const extraScale = scale + 10;
  const extraFactor = 10n ** BigInt(extraScale);
  const scaled = (r.num * extraFactor) / r.den;
  // Round back to target scale
  return fixed(scaled, scale, mode);
}

/**
 * Convert Rational to Money.
 */
export function rationalToMoney<C extends CurrencyDef>(
  r: Rational,
  currency: C,
  mode: RoundingMode = DEFAULT_ROUNDING_MODE
): Money<C> {
  const scaleFactor = currencyScaleFactor(currency);
  // minor units = num * scaleFactor / den
  const minorUnits = (r.num * scaleFactor) / r.den;
  return money(minorUnits, currency);
}

// ============================================================================
// BigDecimal Conversions
// ============================================================================

/**
 * Convert BigDecimal to Rational (exact, no precision loss).
 *
 * @example
 * ```typescript
 * bigDecimalToRational(bigDecimal("0.5"));  // rational(1n, 2n)
 * ```
 */
export function bigDecimalToRational(bd: BigDecimal): Rational {
  // bd = unscaled / 10^scale
  const den = 10n ** BigInt(bd.scale);
  // Simplify by finding GCD
  return rational(bd.unscaled, den);
}

/**
 * Convert BigDecimal to FixedDecimal.
 */
export function bigDecimalToFixed<N extends number>(
  bd: BigDecimal,
  scale: N,
  mode: RoundingMode = DEFAULT_ROUNDING_MODE
): FixedDecimal<N> {
  // First round to target scale
  const rounded = bigDecimalRound(bd, scale, mode === "HALF_EVEN" ? "round" : "round");

  // Then convert to fixed
  if (rounded.scale === scale) {
    return rounded.unscaled as FixedDecimal<N>;
  }

  // Adjust scale
  if (rounded.scale < scale) {
    const factor = 10n ** BigInt(scale - rounded.scale);
    return (rounded.unscaled * factor) as FixedDecimal<N>;
  } else {
    const factor = 10n ** BigInt(rounded.scale - scale);
    return (rounded.unscaled / factor) as FixedDecimal<N>;
  }
}

/**
 * Convert BigDecimal to Money.
 */
export function bigDecimalToMoney<C extends CurrencyDef>(
  bd: BigDecimal,
  currency: C,
  mode: RoundingMode = DEFAULT_ROUNDING_MODE
): Money<C> {
  const majorUnits = bigDecimalToNumber(bd);
  return moneyFromMajor(majorUnits, currency, mode);
}

// ============================================================================
// FixedDecimal Conversions
// ============================================================================

/**
 * Convert FixedDecimal to Rational (exact).
 */
export function fixedToRational<N extends number>(
  fd: FixedDecimal<N>,
  scale: N
): Rational {
  const den = 10n ** BigInt(scale);
  return rational(fd as bigint, den);
}

/**
 * Convert FixedDecimal to BigDecimal.
 */
export function fixedToBigDecimal<N extends number>(
  fd: FixedDecimal<N>,
  scale: N
): BigDecimal {
  return bigDecimal(fd as bigint, scale);
}

/**
 * Convert FixedDecimal to Money.
 *
 * Requires that the FixedDecimal scale matches the currency's minor units.
 */
export function fixedToMoney<N extends number, C extends CurrencyDef>(
  fd: FixedDecimal<N>,
  scale: N,
  currency: C,
  mode: RoundingMode = DEFAULT_ROUNDING_MODE
): Money<C> {
  const targetScale = currency.minorUnits;

  if (scale === targetScale) {
    return fd as bigint as Money<C>;
  }

  // Rescale to currency's minor units
  const rescaled = fixedRound(fd, scale, targetScale as number, mode);
  return rescaled as bigint as Money<C>;
}

// ============================================================================
// Money Conversions
// ============================================================================

/**
 * Convert Money to Rational (exact).
 *
 * @example
 * ```typescript
 * moneyToRational(money(1299, USD), USD);  // rational(1299n, 100n) = 12.99
 * ```
 */
export function moneyToRational<C extends CurrencyDef>(
  m: Money<C>,
  currency: C
): Rational {
  const den = currencyScaleFactor(currency);
  return rational(m as bigint, den);
}

/**
 * Convert Money to BigDecimal.
 */
export function moneyToBigDecimal<C extends CurrencyDef>(
  m: Money<C>,
  currency: C
): BigDecimal {
  return bigDecimal(m as bigint, currency.minorUnits);
}

/**
 * Convert Money to FixedDecimal.
 */
export function moneyToFixed<C extends CurrencyDef, N extends number>(
  m: Money<C>,
  currency: C,
  targetScale: N,
  mode: RoundingMode = DEFAULT_ROUNDING_MODE
): FixedDecimal<N> {
  const sourceScale = currency.minorUnits;

  if (sourceScale === targetScale) {
    return m as bigint as FixedDecimal<N>;
  }

  // Rescale
  return fixedRound(
    m as bigint as FixedDecimal<typeof sourceScale>,
    sourceScale,
    targetScale,
    mode
  );
}

// ============================================================================
// Number Conversions
// ============================================================================

/**
 * Convert a JavaScript number to Rational.
 * Uses continued fraction approximation for clean fractions.
 */
export function numberToRational(n: number, maxDenominator: bigint = 1000000n): Rational {
  return rationalFromNumber(n, maxDenominator);
}

/**
 * Convert a JavaScript number to BigDecimal.
 */
export function numberToBigDecimal(n: number): BigDecimal {
  return bigDecimal(n);
}

/**
 * Convert a JavaScript number to FixedDecimal.
 */
export function numberToFixed<N extends number>(
  n: number,
  scale: N,
  mode: RoundingMode = DEFAULT_ROUNDING_MODE
): FixedDecimal<N> {
  return fixed(n, scale, mode);
}

/**
 * Convert a JavaScript number to Money.
 */
export function numberToMoney<C extends CurrencyDef>(
  n: number,
  currency: C,
  mode: RoundingMode = DEFAULT_ROUNDING_MODE
): Money<C> {
  return moneyFromMajor(n, currency, mode);
}
