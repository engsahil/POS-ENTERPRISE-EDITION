/**
 * Customer records — lightweight on purpose.
 *
 * One record per person, created at checkout from the POS name/phone fields
 * or manually from the Customers screen. A returning customer is found by
 * normalised phone number first (digits only) and by exact name only when
 * no phone was given, so loose name matching never merges the wrong people
 * and checkout never needs an extra step.
 *
 * Statistics (orders, spend, last order) are always derived from the orders
 * store — there is no duplicated counter that could drift out of sync.
 */

import { customersRepository, ordersRepository } from '@/data/repositories';
import type { CustomerRecord, OrderRecord } from '@/types/domain';
import type { ID, Paisa } from '@/types/common';
import { sanitiseText } from '@/utils/validate';

/** Digits-only key used to recognise the same phone number again. */
export function phoneKey(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '');
}

export interface CustomerInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
}

export interface CustomerStats {
  /** Completed, non-cancelled orders. */
  orderCount: number;
  /** Sum of grand totals for those orders. */
  totalSpent: Paisa;
  /** completedAt of the most recent such order, or null. */
  lastOrderAt: string | null;
  /** Cancelled orders are shown in history but never counted as spend. */
  cancelledCount: number;
}

function optionalField(value: string | undefined, max: number): string | undefined {
  const trimmed = sanitiseText(value ?? '', max).trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export const customerService = {
  async list(): Promise<CustomerRecord[]> {
    const customers = await customersRepository.list();
    return customers.sort((a, b) =>
      (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
    );
  },

  async get(id: ID): Promise<CustomerRecord | undefined> {
    return customersRepository.getById(id);
  },

  async create(input: CustomerInput): Promise<CustomerRecord> {
    const name = sanitiseText(input.name, 80).trim();
    if (!name) throw new Error('Customer name is required.');
    const key = phoneKey(input.phone);
    return customersRepository.create({
      name,
      phone: optionalField(input.phone, 30),
      phoneKey: key,
      email: optionalField(input.email, 120),
      address: optionalField(input.address, 200),
      note: optionalField(input.note, 300),
    });
  },

  async update(id: ID, input: CustomerInput): Promise<CustomerRecord> {
    const name = sanitiseText(input.name, 80).trim();
    if (!name) throw new Error('Customer name is required.');
    return customersRepository.update(id, {
      name,
      phone: optionalField(input.phone, 30),
      phoneKey: phoneKey(input.phone),
      email: optionalField(input.email, 120),
      address: optionalField(input.address, 200),
      note: optionalField(input.note, 300),
    });
  },

  /**
   * Resolve the customer for a checkout: reuse the existing record when the
   * phone (or, without a phone, the exact name) matches, otherwise create
   * one. Returns null when the order carries no customer details at all.
   */
  async upsertFromCheckout(input: {
    name?: string;
    phone?: string;
  }): Promise<CustomerRecord | null> {
    const name = sanitiseText(input.name ?? '', 80).trim();
    const phone = sanitiseText(input.phone ?? '', 30).trim();
    if (!name && !phone) return null;

    const key = phoneKey(phone);
    let match: CustomerRecord | undefined;

    if (key) {
      const found = await customersRepository.findByIndex('by_phoneKey', key);
      match = found[0];
    } else {
      const all = await customersRepository.list();
      const lowered = name.toLowerCase();
      match = all.find(
        (record) => record.name.trim().toLowerCase() === lowered,
      );
    }

    if (match) {
      // Refresh what checkout knows; keep everything already stored.
      const patch: Partial<CustomerRecord> = {};
      if (name && name !== match.name) patch.name = name;
      if (phone && phone !== match.phone) {
        patch.phone = phone;
        patch.phoneKey = key;
      }
      if (Object.keys(patch).length === 0) return match;
      return customersRepository.update(match.id, patch);
    }

    return customersRepository.create({
      // With no name, the phone is the only identifying detail to show.
      name: name || phone,
      phone: phone || undefined,
      phoneKey: key,
    });
  },

  /** Derive history statistics from the customer's orders. */
  async stats(customerId: ID): Promise<CustomerStats> {
    const orders = await ordersRepository.findByIndex(
      'by_customerId',
      customerId,
    );
    let orderCount = 0;
    let totalSpent = 0;
    let cancelledCount = 0;
    let lastOrderAt: string | null = null;

    const countable = (order: OrderRecord): boolean =>
      order.status === 'completed';

    for (const order of orders) {
      if (order.status === 'cancelled') {
        cancelledCount += 1;
        continue;
      }
      if (!countable(order)) continue;
      orderCount += 1;
      if (typeof order.grandTotal === 'number' && Number.isFinite(order.grandTotal)) {
        totalSpent += Math.max(0, order.grandTotal);
      }
      const at = order.completedAt ?? order.createdAt;
      if (at && (!lastOrderAt || at > lastOrderAt)) lastOrderAt = at;
    }

    return { orderCount, totalSpent, lastOrderAt, cancelledCount };
  },

  /** Orders for one customer, newest first — the customer's history. */
  async ordersFor(customerId: ID): Promise<OrderRecord[]> {
    const orders = await ordersRepository.findByIndex(
      'by_customerId',
      customerId,
    );
    return orders.sort((a, b) =>
      (b.completedAt ?? b.createdAt).localeCompare(
        a.completedAt ?? a.createdAt,
      ),
    );
  },
};
