/**
 * Receipt composition.
 *
 * Builds a complete, self-contained receipt model from a stored order, so the
 * layout component never has to reach into the database or guess at missing
 * data. Everything optional is resolved to an explicit presence flag here,
 * which is what keeps the layout from producing empty gaps.
 */

import { orderService } from './orderService';
import { restaurantService } from './restaurantService';
import { settingsService } from './settingsService';
import {
  dealsRepository,
  menuItemsRepository,
  itemPricesRepository,
  ordersRepository,
} from '@/data/repositories';
import type {
  OrderItemRecord,
  OrderRecord,
  OrderType,
  RestaurantLogo,
  SelectedAddOn,
  SelectedTopping,
} from '@/types/domain';
import type { ID, Paisa } from '@/types/common';

/** Supported thermal paper widths. */
export const RECEIPT_WIDTHS = ['58mm', '80mm'] as const;
export type ReceiptWidth = (typeof RECEIPT_WIDTHS)[number];

export const DEFAULT_RECEIPT_WIDTH: ReceiptWidth = '80mm';

/** Persisted default paper width. */
export const RECEIPT_WIDTH_KEY = 'receipt.width';

export interface ReceiptLine {
  id: ID;
  name: string;
  /** Size label, or null for deals and unsized items. */
  sizeLabel: string | null;
  quantity: number;
  unitPrice: Paisa;
  lineTotal: Paisa;
  /** True when this line is a deal rather than a single menu item. */
  isDeal: boolean;
  /** Products inside the deal, for the receipt's breakdown. */
  dealContents: string[];
  /** Value the customer saved on this deal line, if any. */
  dealSavings: Paisa;
  toppings: SelectedTopping[];
  addOns: SelectedAddOn[];
  toppingTotal: Paisa;
  addOnTotal: Paisa;
}

export interface ReceiptHeader {
  /** Restaurant name, or null when the profile has not been filled in. */
  name: string | null;
  logo: RestaurantLogo | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  receiptInfo: string | null;
}

export interface ReceiptModel {
  header: ReceiptHeader;
  orderNumber: string;
  orderId: ID;
  date: string;
  time: string;
  lines: ReceiptLine[];
  subtotal: Paisa;
  taxTotal: Paisa;
  taxPercent: number;
  /** Total saved across every deal on the order. */
  savingsTotal: Paisa;
  grandTotal: Paisa;
  itemCount: number;
  paymentMethod: string;
  footer: string | null;
  orderType: OrderType;
  tableLabel: string | null;
  customerName: string | null;
  customerPhone: string | null;
  note: string | null;
  discountTotal: Paisa;
  amountPaid: Paisa | null;
  changeDue: Paisa | null;
}

export interface KitchenReceiptModel {
  orderNumber: string;
  orderId: ID;
  date: string;
  time: string;
  orderType: OrderType;
  tableLabel: string | null;
  customerName: string | null;
  customerPhone: string | null;
  note: string | null;
  lines: ReceiptLine[];
  itemCount: number;
}

/** Blank strings become null so the layout can omit the row entirely. */
function orNull(value: string | undefined | null): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatReceiptDate(iso: string): string {
  const date = new Date(iso);
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function formatReceiptTime(iso: string): string {
  const date = new Date(iso);
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${suffix}`;
}

export const receiptService = {
  /** The operator's saved default paper width. */
  async getWidth(): Promise<ReceiptWidth> {
    const stored = await settingsService.get<string>(
      RECEIPT_WIDTH_KEY,
      DEFAULT_RECEIPT_WIDTH,
    );
    return (RECEIPT_WIDTHS as readonly string[]).includes(stored)
      ? (stored as ReceiptWidth)
      : DEFAULT_RECEIPT_WIDTH;
  },

  async setWidth(width: ReceiptWidth): Promise<void> {
    await settingsService.set(RECEIPT_WIDTH_KEY, width);
  },

  /**
   * Assemble a receipt from an order and its items.
   */
  async build(
    order: OrderRecord,
    items: OrderItemRecord[],
  ): Promise<ReceiptModel> {
    const profile = await restaurantService.getRecord();

    const lines: ReceiptLine[] = [];
    let savingsTotal = 0;

    for (const item of items) {
      let dealContents: string[] = [];
      let dealSavings = 0;

      if (item.dealId) {
        const deal = await dealsRepository.getById(item.dealId);

        if (deal) {
          let contentsValue = 0;

          dealContents = await Promise.all(
            deal.items.map(async (line) => {
              const menuItem = await menuItemsRepository.getById(
                line.menuItemId,
              );
              const label = menuItem?.name ?? 'Item';
              const size = line.sizeLabel ? ` (${line.sizeLabel})` : '';

              const prices = await itemPricesRepository.findByIndex(
                'by_menuItemId',
                line.menuItemId,
              );
              const priceRow = prices.find(
                (row) => row.label === line.sizeLabel,
              );
              if (priceRow) contentsValue += priceRow.price * line.quantity;

              return `${line.quantity} x ${label}${size}`;
            }),
          );

          const separately = contentsValue * item.quantity;
          dealSavings = Math.max(0, separately - item.lineTotal);
        }
      }

      lines.push({
        id: item.id,
        name: item.name,
        sizeLabel: orNull(item.sizeLabel),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        isDeal: Boolean(item.dealId),
        dealContents,
        dealSavings,
        toppings: item.toppings ?? [],
        addOns: item.addOns ?? [],
        toppingTotal: item.toppingTotal ?? 0,
        addOnTotal: item.addOnTotal ?? 0,
      });

      savingsTotal += dealSavings;
    }

    return {
      header: {
        name: orNull(profile?.name),
        logo: profile?.logo ?? null,
        address: orNull(profile?.address),
        phone: orNull(profile?.phone),
        email: orNull(profile?.email),
        receiptInfo: orNull(profile?.receiptInfo),
      },
      orderNumber: order.orderNumber,
      orderId: order.id,
      date: formatReceiptDate(order.completedAt ?? order.createdAt),
      time: formatReceiptTime(order.completedAt ?? order.createdAt),
      lines,
      subtotal: order.subtotal,
      taxTotal: order.taxTotal,
      taxPercent: profile?.taxPercent ?? 0,
      savingsTotal,
      grandTotal: order.grandTotal,
      itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
      paymentMethod: order.paymentMethod ?? 'cash',
      footer: orNull(profile?.receiptFooter),
      orderType: order.orderType ?? 'takeaway',
      tableLabel: orNull(order.tableLabel),
      customerName: orNull(order.customerName),
      customerPhone: orNull(order.customerPhone),
      note: orNull(order.note),
      discountTotal: order.discountTotal ?? 0,
      amountPaid: order.amountPaid ?? null,
      changeDue: order.changeDue ?? null,
    };
  },

  async buildKitchen(
    order: OrderRecord,
    items: OrderItemRecord[],
  ): Promise<KitchenReceiptModel> {
    const customer = await this.build(order, items);
    return {
      orderNumber: customer.orderNumber,
      orderId: customer.orderId,
      date: customer.date,
      time: customer.time,
      orderType: customer.orderType,
      tableLabel: customer.tableLabel,
      customerName: customer.customerName,
      customerPhone: customer.customerPhone,
      note: customer.note,
      lines: customer.lines,
      itemCount: customer.itemCount,
    };
  },

  /** Build a receipt for a stored order id. */
  async buildById(orderId: ID): Promise<ReceiptModel | undefined> {
    const order = await ordersRepository.getById(orderId);
    if (!order) return undefined;
    const items = await orderService.getOrderItems(orderId);
    return this.build(order, items);
  },

  async buildKitchenById(orderId: ID): Promise<KitchenReceiptModel | undefined> {
    const order = await ordersRepository.getById(orderId);
    if (!order) return undefined;
    const items = await orderService.getOrderItems(orderId);
    return this.buildKitchen(order, items);
  },
};
