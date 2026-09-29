/**
 * Central application configuration.
 * Single source of truth for identity, versioning and currency.
 */

export const APP_VERSION = '2.1.5' as const;

export const APP_CONFIG = {
  name: 'POS',
  shortName: 'POS',
  version: APP_VERSION,
  /** Bump when a breaking storage/schema migration is required. */
  schemaVersion: 1,
  locale: 'en-PK',
  timezone: 'Asia/Karachi',
} as const;

/**
 * Currency: Pakistani Rupees only. No multi-currency support by design.
 */
export const CURRENCY = {
  code: 'PKR',
  symbol: 'Rs.',
  /** Sub-unit precision used for display. */
  decimals: 2,
  /** Smallest physical denomination used for cash rounding. */
  cashRounding: 1,
  position: 'prefix',
} as const;

export type AppConfig = typeof APP_CONFIG;
export type CurrencyConfig = typeof CURRENCY;
