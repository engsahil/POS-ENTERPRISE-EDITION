/**
 * Payment method labels.
 *
 * One list drives the checkout selector and every display of a stored
 * method (receipts, sales list), so the wording can never drift between
 * them.
 */

import type { PaymentMethod } from '@/types/domain';

export interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
}

export const PAYMENT_METHOD_OPTIONS: readonly PaymentMethodOption[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'digital', label: 'Digital Payment' },
];

/** Human label for a stored payment method, e.g. "Cash", "Digital Payment". */
export function formatPaymentMethod(
  method: PaymentMethod | string | null | undefined,
): string {
  const match = PAYMENT_METHOD_OPTIONS.find((option) => option.value === method);
  if (match) return match.label;
  if (method === 'other') return 'Other';
  return 'Cash';
}
