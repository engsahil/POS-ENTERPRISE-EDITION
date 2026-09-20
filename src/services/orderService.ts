/**
 * Billing and order completion.
 *
 * Cart state lives in the UI; this module owns the money maths and the
 * permanent record of a completed order. Everything runs against locally
 * stored data — no network is involved, so billing works fully offline.
 *
 * All money is integer paisa. Rupee values never enter the arithmetic.
 */

import { STORES } from '@/config/storage.config';
import { db } from '@/data/db/indexedDb';
import {
  inventoryRepository,
  orderItemsRepository,
  ordersRepository,
  salesRepository,
} from '@/data/repositories';
import { getTaxConfig } from './restaurantService';
import { settingsService, SETTING_KEYS } from './settingsService';
import { syncQueueService } from './syncQueueService';
import type { SizeLabel } from './menuService';
import type {
  OrderItemRecord,
  OrderRecord,
  OrderType,
  PaymentMethod,
  SaleRecord,
  SelectedAddOn,
  SelectedTopping,
} from '@/types/domain';
import type { ID, Paisa } from '@/types/common';
import { createId } from '@/utils/id';
import { nowISO } from '@/utils/date';
import {
  assertPaisa,
  assertQuantity,
  assertText,
  isFiniteNumber,
  ValidationError,
} from '@/utils/validate';

/**
 * A line in the cart, before it becomes an order item.
 *
 * A line is either a menu item at a size, or a deal. Deals carry `dealId`
 * and no size; the two are distinguished by `kind`.
 */
export interface CartLine {
  /** Stable key: menu item + size, or the deal id. */
  key: string;
  kind: 'item' | 'deal';
  menuItemId: ID | null;
  dealId: ID | null;
  itemPriceId: ID | null;
  name: string;
  sizeLabel: SizeLabel | null;
  unitPrice: Paisa;
  quantity: number;
  toppings: SelectedTopping[];
  addOns: SelectedAddOn[];
}

export interface CartTotals {
  subtotal: Paisa;
  taxTotal: Paisa;
  grandTotal: Paisa;
  itemCount: number;
  taxPercent: number;
  taxInclusive: boolean;
}

export const MAX_LINE_QUANTITY = 999;

/** Stable key so the same item+size stacks instead of duplicating. */
export function cartLineKey(menuItemId: ID, size: SizeLabel): string {
  return `${menuItemId}::${size}`;
}

/** Stable key for a deal line. */
export function dealLineKey(dealId: ID): string {
  return `deal::${dealId}`;
}

function sumToppings(toppings: SelectedTopping[]): Paisa {
  return toppings.reduce((s, t) => s + (isFiniteNumber(t.price) ? Math.max(0, t.price) : 0), 0);
}

function sumAddOns(addOns: SelectedAddOn[]): Paisa {
  return addOns.reduce((s, a) => s + (isFiniteNumber(a.price) ? Math.max(0, a.price) : 0), 0);
}

export function lineUnitTotal(line: CartLine): Paisa {
  const base = isFiniteNumber(line.unitPrice) ? Math.max(0, line.unitPrice) : 0;
  return base + sumToppings(line.toppings) + sumAddOns(line.addOns);
}

export function lineTotal(line: CartLine): Paisa {
  const unit = lineUnitTotal(line);
  const qty = isFiniteNumber(line.quantity) ? Math.max(0, Math.floor(line.quantity)) : 0;
  return unit * qty;
}

/**
 * Compute totals for a cart.
 *
 * Exclusive tax is added on top of the subtotal. Inclusive tax is extracted
 * from it, so the grand total still equals the sum of the displayed prices.
 * Rounding happens once, at the tax figure, to avoid per-line drift.
 */
export function calculateTotals(
  lines: CartLine[],
  taxPercent: number,
  taxInclusive: boolean,
): CartTotals {
  const safeLineTotal = (line: CartLine): number => {
    const total = lineTotal(line);
    return isFiniteNumber(total) ? Math.max(0, total) : 0;
  };

  const gross = lines.reduce((sum, line) => sum + safeLineTotal(line), 0);
  const itemCount = lines.reduce(
    (sum, line) =>
      sum + (isFiniteNumber(line.quantity) ? Math.max(0, Math.floor(line.quantity)) : 0),
    0,
  );
  const rate = Number.isFinite(taxPercent)
    ? Math.min(100, Math.max(0, taxPercent))
    : 0;

  if (rate === 0) {
    return {
      subtotal: gross,
      taxTotal: 0,
      grandTotal: gross,
      itemCount,
      taxPercent: 0,
      taxInclusive,
    };
  }

  if (taxInclusive) {
    const net = Math.round((gross * 100) / (100 + rate));
    return {
      subtotal: net,
      taxTotal: gross - net,
      grandTotal: gross,
      itemCount,
      taxPercent: rate,
      taxInclusive,
    };
  }

  const taxTotal = Math.round((gross * rate) / 100);
  return {
    subtotal: gross,
    taxTotal,
    grandTotal: gross + taxTotal,
    itemCount,
    taxPercent: rate,
    taxInclusive,
  };
}

/**
 * Zero-padded, per-installation sequential order number, e.g. "0001".
 */
async function nextOrderNumber(): Promise<string> {
  const [current, prefix] = await Promise.all([
    settingsService.get<number>(SETTING_KEYS.orderSequence, 0),
    settingsService.get<string>(SETTING_KEYS.orderNumberPrefix, ''),
  ]);

  const next = current + 1;
  await settingsService.set(SETTING_KEYS.orderSequence, next);
  return `${prefix ?? ''}${String(next).padStart(4, '0')}`;
}

export interface CompleteOrderInput {
  lines: CartLine[];
  paymentMethod?: PaymentMethod;
  amountPaid?: Paisa;
  orderType?: OrderType;
  tableLabel?: string;
  customerName?: string;
  customerPhone?: string;
  note?: string;
}

export interface CompletedOrder {
  order: OrderRecord;
  items: OrderItemRecord[];
  sale: SaleRecord;
}

function businessDateOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const orderService = {
  calculateTotals,

  async taxConfig() {
    return getTaxConfig();
  },

  async complete(input: CompleteOrderInput): Promise<CompletedOrder> {
    const { lines } = input;
    if (lines.length === 0) {
      throw new Error('Cannot complete an empty order.');
    }

    const validated: CartLine[] = lines.map((line, index) => ({
      ...line,
      name: assertText(line.name, `Item ${index + 1} name`, { max: 120 }),
      unitPrice: assertPaisa(line.unitPrice, `Item "${line.name}" price`),
      quantity: assertQuantity(line.quantity, `Item "${line.name}" quantity`),
      toppings: (line.toppings ?? []).map((t) => ({
        name: assertText(t.name, 'Topping name', { max: 80 }),
        price: assertPaisa(t.price, `Topping "${t.name}" price`),
      })),
      addOns: (line.addOns ?? []).map((a) => ({
        name: assertText(a.name, 'Add-on name', { max: 80 }),
        price: assertPaisa(a.price, `Add-on "${a.name}" price`),
      })),
    }));

    const { taxPercent, taxInclusive } = await getTaxConfig();
    const totals = calculateTotals(validated, taxPercent, taxInclusive);

    if (
      !Number.isSafeInteger(totals.grandTotal) ||
      !Number.isSafeInteger(totals.subtotal) ||
      totals.grandTotal < 0
    ) {
      throw new ValidationError('Order total could not be calculated safely.');
    }

    const orderNumber = await nextOrderNumber();
    const timestamp = nowISO();
    const orderId = createId();
    const paymentMethod: PaymentMethod = input.paymentMethod ?? 'cash';
    const amountPaid = input.amountPaid ?? totals.grandTotal;

    const orderType: OrderType = input.orderType ?? 'takeaway';
    const tableLabel = input.tableLabel?.trim() ? input.tableLabel.trim().slice(0, 20) : undefined;
    const customerName = input.customerName?.trim() ? input.customerName.trim().slice(0, 80) : undefined;
    const customerPhone = input.customerPhone?.trim() ? input.customerPhone.trim().slice(0, 30) : undefined;
    const note = input.note?.trim() ? input.note.trim().slice(0, 300) : undefined;

    const order: OrderRecord = {
      id: orderId,
      orderNumber,
      status: 'completed',
      orderType,
      subtotal: totals.subtotal,
      discountTotal: 0,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      paymentMethod,
      amountPaid,
      changeDue: Math.max(0, amountPaid - totals.grandTotal),
      tableLabel,
      customerName,
      customerPhone,
      note,
      completedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      rev: 1,
    };

    const items: OrderItemRecord[] = validated.map((line) => {
      const toppingTotal = sumToppings(line.toppings);
      const addOnTotal = sumAddOns(line.addOns);
      return {
        id: createId(),
        orderId,
        menuItemId: line.menuItemId,
        dealId: line.dealId,
        itemPriceId: line.itemPriceId,
        name: line.name,
        sizeLabel: line.sizeLabel ?? undefined,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        discount: 0,
        lineTotal: lineTotal(line),
        toppings: line.toppings.length ? line.toppings : undefined,
        addOns: line.addOns.length ? line.addOns : undefined,
        toppingTotal: toppingTotal || undefined,
        addOnTotal: addOnTotal || undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        rev: 1,
      };
    });

    const sale: SaleRecord = {
      id: createId(),
      orderId,
      orderNumber,
      businessDate: businessDateOf(new Date()),
      completedAt: timestamp,
      subtotal: totals.subtotal,
      discountTotal: 0,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      paymentMethod,
      itemCount: totals.itemCount,
      refundedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      rev: 1,
    };

    await db.transaction(
      [STORES.orders, STORES.orderItems, STORES.sales],
      'readwrite',
      async (stores) => {
        const orderStore = stores[STORES.orders];
        const itemStore = stores[STORES.orderItems];
        const saleStore = stores[STORES.sales];
        if (!orderStore || !itemStore || !saleStore) {
          throw new Error('Order stores are unavailable.');
        }

        await db.request(orderStore.put(order));
        for (const item of items) {
          await db.request(itemStore.put(item));
        }
        await db.request(saleStore.put(sale));
      },
    );

    try {
      await syncQueueService.enqueue({
        entity: STORES.orders,
        entityId: orderId,
        operation: 'create',
        payload: { order, items, sale },
      });

      void import('./sync/syncEngine').then(({ syncEngine }) => {
        void syncEngine.refresh();
      });
    } catch {
      /* the order is safely stored; sync can be reconciled later */
    }

    await this.deductStock(validated);

    return { order, items, sale };
  },

  async deductStock(lines: CartLine[]): Promise<void> {
    const soldByMenuItem = new Map<ID, number>();
    for (const line of lines) {
      if (line.kind !== 'item' || !line.menuItemId) continue;
      soldByMenuItem.set(
        line.menuItemId,
        (soldByMenuItem.get(line.menuItemId) ?? 0) + line.quantity,
      );
    }

    for (const [menuItemId, quantity] of soldByMenuItem) {
      const matches = await inventoryRepository.findByIndex(
        'by_menuItemId',
        menuItemId,
      );
      const record = matches[0];
      if (!record) continue;

      const next = Math.max(0, Number((record.quantity - quantity).toFixed(3)));
      await inventoryRepository.update(record.id, {
        quantity: next,
        isOutOfStock: next <= 0 ? 1 : record.isOutOfStock,
      });
    }
  },

  async getOrder(id: ID): Promise<OrderRecord | undefined> {
    return ordersRepository.getById(id);
  },

  async getOrderItems(orderId: ID): Promise<OrderItemRecord[]> {
    return orderItemsRepository.findByIndex('by_orderId', orderId);
  },

  async recentOrders(limit = 20): Promise<OrderRecord[]> {
    const orders = await ordersRepository.list();
    return orders
      .filter((order) => order.status === 'completed')
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
      .slice(0, limit);
  },

  async count(): Promise<number> {
    return (await ordersRepository.list()).length;
  },

  async salesCount(): Promise<number> {
    return (await salesRepository.list()).length;
  },
};
