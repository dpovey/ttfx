/**
 * Currencies - ISO 4217 Currency Definitions
 *
 * Standard currency definitions with proper minor unit counts.
 * Used by the Money type for type-safe currency operations.
 *
 * @example
 * ```typescript
 * import { USD, EUR, JPY, money } from "@typesugar/math";
 *
 * const price = money(1299, USD);   // $12.99
 * const euros = money(999, EUR);     // €9.99
 * const yen = money(1000, JPY);      // ¥1000 (no minor units)
 * ```
 *
 * @packageDocumentation
 */

/**
 * Currency definition with ISO 4217 metadata.
 *
 * @property code - ISO 4217 currency code (e.g., "USD", "EUR")
 * @property minorUnits - Number of minor unit digits (0-4)
 * @property symbol - Currency symbol for display
 * @property name - Full currency name
 */
export interface CurrencyDef<Code extends string = string> {
  readonly code: Code;
  readonly minorUnits: number;
  readonly symbol: string;
  readonly name: string;
}

/**
 * Create a currency definition.
 */
function currency<Code extends string>(
  code: Code,
  minorUnits: number,
  symbol: string,
  name: string
): CurrencyDef<Code> {
  return Object.freeze({ code, minorUnits, symbol, name });
}

// ============================================================================
// Major World Currencies
// ============================================================================

/** United States Dollar */
export const USD = currency("USD", 2, "$", "US Dollar");

/** Euro */
export const EUR = currency("EUR", 2, "€", "Euro");

/** British Pound Sterling */
export const GBP = currency("GBP", 2, "£", "Pound Sterling");

/** Japanese Yen */
export const JPY = currency("JPY", 0, "¥", "Yen");

/** Chinese Yuan Renminbi */
export const CNY = currency("CNY", 2, "¥", "Yuan Renminbi");

/** Swiss Franc */
export const CHF = currency("CHF", 2, "CHF", "Swiss Franc");

/** Canadian Dollar */
export const CAD = currency("CAD", 2, "CA$", "Canadian Dollar");

/** Australian Dollar */
export const AUD = currency("AUD", 2, "A$", "Australian Dollar");

/** New Zealand Dollar */
export const NZD = currency("NZD", 2, "NZ$", "New Zealand Dollar");

/** Hong Kong Dollar */
export const HKD = currency("HKD", 2, "HK$", "Hong Kong Dollar");

/** Singapore Dollar */
export const SGD = currency("SGD", 2, "S$", "Singapore Dollar");

// ============================================================================
// European Currencies (non-Euro)
// ============================================================================

/** Swedish Krona */
export const SEK = currency("SEK", 2, "kr", "Swedish Krona");

/** Norwegian Krone */
export const NOK = currency("NOK", 2, "kr", "Norwegian Krone");

/** Danish Krone */
export const DKK = currency("DKK", 2, "kr", "Danish Krone");

/** Polish Zloty */
export const PLN = currency("PLN", 2, "zł", "Zloty");

/** Czech Koruna */
export const CZK = currency("CZK", 2, "Kč", "Czech Koruna");

/** Hungarian Forint */
export const HUF = currency("HUF", 2, "Ft", "Forint");

/** Russian Ruble */
export const RUB = currency("RUB", 2, "₽", "Russian Ruble");

// ============================================================================
// Asian Currencies
// ============================================================================

/** South Korean Won */
export const KRW = currency("KRW", 0, "₩", "Won");

/** Indian Rupee */
export const INR = currency("INR", 2, "₹", "Indian Rupee");

/** Thai Baht */
export const THB = currency("THB", 2, "฿", "Baht");

/** Malaysian Ringgit */
export const MYR = currency("MYR", 2, "RM", "Malaysian Ringgit");

/** Indonesian Rupiah */
export const IDR = currency("IDR", 2, "Rp", "Rupiah");

/** Philippine Peso */
export const PHP = currency("PHP", 2, "₱", "Philippine Peso");

/** Vietnamese Dong */
export const VND = currency("VND", 0, "₫", "Dong");

/** Taiwan Dollar */
export const TWD = currency("TWD", 2, "NT$", "New Taiwan Dollar");

// ============================================================================
// Americas
// ============================================================================

/** Mexican Peso */
export const MXN = currency("MXN", 2, "MX$", "Mexican Peso");

/** Brazilian Real */
export const BRL = currency("BRL", 2, "R$", "Brazilian Real");

/** Argentine Peso */
export const ARS = currency("ARS", 2, "AR$", "Argentine Peso");

/** Chilean Peso */
export const CLP = currency("CLP", 0, "CL$", "Chilean Peso");

/** Colombian Peso */
export const COP = currency("COP", 2, "CO$", "Colombian Peso");

// ============================================================================
// Middle East & Africa
// ============================================================================

/** United Arab Emirates Dirham */
export const AED = currency("AED", 2, "د.إ", "UAE Dirham");

/** Saudi Riyal */
export const SAR = currency("SAR", 2, "﷼", "Saudi Riyal");

/** Israeli New Shekel */
export const ILS = currency("ILS", 2, "₪", "New Israeli Shekel");

/** Turkish Lira */
export const TRY = currency("TRY", 2, "₺", "Turkish Lira");

/** South African Rand */
export const ZAR = currency("ZAR", 2, "R", "Rand");

/** Egyptian Pound */
export const EGP = currency("EGP", 2, "E£", "Egyptian Pound");

/** Kuwaiti Dinar (3 minor units) */
export const KWD = currency("KWD", 3, "د.ك", "Kuwaiti Dinar");

/** Bahraini Dinar (3 minor units) */
export const BHD = currency("BHD", 3, "ب.د", "Bahraini Dinar");

/** Omani Rial (3 minor units) */
export const OMR = currency("OMR", 3, "ر.ع.", "Rial Omani");

// ============================================================================
// Precious Metals (ISO 4217)
// ============================================================================

/** Gold (troy ounce) */
export const XAU = currency("XAU", 0, "XAU", "Gold");

/** Silver (troy ounce) */
export const XAG = currency("XAG", 0, "XAG", "Silver");

/** Platinum (troy ounce) */
export const XPT = currency("XPT", 0, "XPT", "Platinum");

/** Palladium (troy ounce) */
export const XPD = currency("XPD", 0, "XPD", "Palladium");

// ============================================================================
// Cryptocurrencies (common conventions)
// ============================================================================

/** Bitcoin (8 decimal places for satoshis) */
export const BTC = currency("BTC", 8, "₿", "Bitcoin");

/** Ethereum (18 decimal places for wei, but commonly 8 for display) */
export const ETH = currency("ETH", 8, "Ξ", "Ether");

// ============================================================================
// Utility Types and Functions
// ============================================================================

/**
 * All predefined currency definitions.
 */
export const ALL_CURRENCIES = [
  USD, EUR, GBP, JPY, CNY, CHF, CAD, AUD, NZD, HKD, SGD,
  SEK, NOK, DKK, PLN, CZK, HUF, RUB,
  KRW, INR, THB, MYR, IDR, PHP, VND, TWD,
  MXN, BRL, ARS, CLP, COP,
  AED, SAR, ILS, TRY, ZAR, EGP, KWD, BHD, OMR,
  XAU, XAG, XPT, XPD,
  BTC, ETH,
] as const;

/**
 * Map of currency code to currency definition.
 */
export const CURRENCY_MAP: Record<string, CurrencyDef> = Object.fromEntries(
  ALL_CURRENCIES.map((c) => [c.code, c])
);

/**
 * Look up a currency by its ISO 4217 code.
 */
export function getCurrency(code: string): CurrencyDef | undefined {
  return CURRENCY_MAP[code.toUpperCase()];
}

/**
 * Get the scale factor (10^minorUnits) for a currency.
 */
export function currencyScaleFactor(currency: CurrencyDef): bigint {
  return 10n ** BigInt(currency.minorUnits);
}

/**
 * Type helper to extract the code type from a currency definition.
 */
export type CurrencyCode<C extends CurrencyDef> = C extends CurrencyDef<infer Code>
  ? Code
  : never;
