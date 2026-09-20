/**
 * Value guards for financial and quantity data.
 *
 * These exist because an audit found that a NaN or negative value entering a
 * service could reach the database and corrupt aggregate figures - a single
 * bad order made the whole day's sales total `null`. UI validation alone was
 * not enough: anything that bypasses a form (a bug, a future feature, a sync
 * payload) reached storage unchecked.
 *
 * The rule applied throughout: reject what is nonsensical, clamp what is
 * merely out of range, and never let a non-finite number reach storage.
 */

/** Largest money value accepted, in paisa. Rs. 100,000,000. */
export const MAX_PAISA = 10_000_000_000;

/** Largest quantity accepted on a single order line. */
export const MAX_LINE_QUANTITY = 9_999;

/** Largest stock quantity accepted. */
export const MAX_STOCK_QUANTITY = 1_000_000;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** True only for a real, finite number. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * A money amount in integer paisa.
 *
 * Rejects NaN, Infinity and negatives; rounds fractional paisa away, since
 * paisa is the smallest unit and a fraction of one cannot be charged.
 */
export function assertPaisa(value: unknown, field: string): number {
  if (!isFiniteNumber(value)) {
    throw new ValidationError(`${field} must be a number.`);
  }
  if (value < 0) {
    throw new ValidationError(`${field} cannot be negative.`);
  }
  if (value > MAX_PAISA) {
    throw new ValidationError(`${field} is unreasonably large.`);
  }
  return Math.round(value);
}

/** A whole quantity of at least one. */
export function assertQuantity(
  value: unknown,
  field: string,
  max = MAX_LINE_QUANTITY,
): number {
  if (!isFiniteNumber(value)) {
    throw new ValidationError(`${field} must be a number.`);
  }
  const whole = Math.floor(value);
  if (whole < 1) {
    throw new ValidationError(`${field} must be at least 1.`);
  }
  if (whole > max) {
    throw new ValidationError(`${field} exceeds the maximum of ${max}.`);
  }
  return whole;
}

/**
 * A stock level. Unlike an order quantity this may legitimately be zero,
 * and fractional units are meaningful (0.5 kg), so only the scale is bounded.
 */
export function clampStock(value: unknown): number {
  if (!isFiniteNumber(value)) return 0;
  if (value < 0) return 0;
  if (value > MAX_STOCK_QUANTITY) return MAX_STOCK_QUANTITY;
  // Three decimal places is the practical limit for weights.
  return Math.round(value * 1000) / 1000;
}

/** A price that may be absent. Invalid values become null rather than NaN. */
export function sanitisePrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (!isFiniteNumber(value)) return null;
  if (value < 0) return null;
  if (value > MAX_PAISA) return MAX_PAISA;
  return Math.round(value);
}

/** A percentage between 0 and 100. */
export function clampPercent(value: unknown): number {
  if (!isFiniteNumber(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Trim and bound a text field. Never returns undefined. */
export function sanitiseText(value: unknown, maxLength = 200): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

/** A required text field. */
export function assertText(
  value: unknown,
  field: string,
  { min = 1, max = 200 }: { min?: number; max?: number } = {},
): string {
  const text = sanitiseText(value, max);
  if (text.length < min) {
    throw new ValidationError(`${field} is required.`);
  }
  return text;
}
