/**
 * Currency helpers — Pakistani Rupees (Rs.) only.
 *
 * Money is stored as integer paisa to avoid floating point drift, and
 * formatted for display through a single function so the symbol never
 * gets hard-coded across the UI.
 */

import { APP_CONFIG, CURRENCY } from '@/config/app.config';
import type { Paisa } from '@/types/common';

const PAISA_PER_RUPEE = 100;

export function toPaisa(rupees: number): Paisa {
  return Math.round(rupees * PAISA_PER_RUPEE);
}

export function toRupees(paisa: Paisa): number {
  return paisa / PAISA_PER_RUPEE;
}

export interface FormatMoneyOptions {
  /** Include the "Rs." symbol. Default: true. */
  withSymbol?: boolean;
  /** Force decimal places. Default: hidden when the amount is whole. */
  decimals?: number;
}

/** Format an integer paisa amount for display, e.g. 125000 -> "Rs. 1,250". */
export function formatMoney(
  paisa: Paisa,
  options: FormatMoneyOptions = {},
): string {
  const { withSymbol = true } = options;
  const rupees = toRupees(paisa);
  const isWhole = Number.isInteger(rupees);
  const decimals = options.decimals ?? (isWhole ? 0 : CURRENCY.decimals);

  const formatted = new Intl.NumberFormat(APP_CONFIG.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(rupees);

  return withSymbol ? `${CURRENCY.symbol} ${formatted}` : formatted;
}

/** Parse user input like "Rs. 1,250.50", "1,250", "-45.5" or "1250" into paisa. */
export function parseMoney(input: string): Paisa | null {
  // Strip the currency symbol first so its trailing dot is not read as a
  // decimal point, then remove grouping separators and any stray characters.
  const withoutSymbol = input
    .replace(new RegExp(CURRENCY.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
    .replace(new RegExp(CURRENCY.code, 'gi'), '');

  const negative = /-/.test(withoutSymbol);
  const digitsAndDots = withoutSymbol.replace(/[^\d.]/g, '');

  if (digitsAndDots === '' || digitsAndDots === '.') return null;

  // Keep only the first decimal point; ignore any extras.
  const firstDot = digitsAndDots.indexOf('.');
  const normalized =
    firstDot === -1
      ? digitsAndDots
      : digitsAndDots.slice(0, firstDot + 1) +
        digitsAndDots.slice(firstDot + 1).replace(/\./g, '');

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  return toPaisa(negative ? -value : value);
}

/** Round to the nearest usable cash denomination (default: 1 rupee). */
export function roundForCash(paisa: Paisa): Paisa {
  const step = CURRENCY.cashRounding * PAISA_PER_RUPEE;
  return Math.round(paisa / step) * step;
}
