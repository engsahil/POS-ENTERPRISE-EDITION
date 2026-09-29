/**
 * Deals management.
 *
 * A deal bundles menu items at a better price. It is priced either as a fixed
 * bundle total or as a percentage off the sum of its contents.
 *
 * Nothing is ever seeded: no example deals, no fake prices. A fresh install
 * has zero deals.
 */

import { dealsRepository } from '@/data/repositories';
import { menuService, type MenuItemWithPrices } from './menuService';
import type { DealLine, DealPricingType, DealRecord, StoredImage } from '@/types/domain';
import type { ID, Paisa } from '@/types/common';

export interface DealItemView extends DealLine {
  /** Resolved item name, or undefined when the menu item was deleted. */
  name?: string;
  /** Unit price for the chosen size, or null when unavailable. */
  unitPrice: Paisa | null;
  /** unitPrice * quantity, or null when the price is unknown. */
  lineTotal: Paisa | null;
}

export interface DealView {
  record: DealRecord;
  items: DealItemView[];
  /** Sum of the included products at menu prices. */
  itemsTotal: Paisa;
  /** What the customer pays for the bundle. */
  dealPrice: Paisa;
  /** itemsTotal - dealPrice, never negative. */
  savings: Paisa;
  /** True when every included product still resolves to a real price. */
  isSellable: boolean;
}

export interface DealInput {
  name: string;
  description: string;
  image: StoredImage | null;
  pricingType: DealPricingType;
  /** Bundle price in paisa. Null when not set or when using percentage. */
  price: Paisa | null;
  /** Percentage off. Null when not set or when using a fixed price. */
  percentOff: number | null;
  items: DealLine[];
  isPublished: boolean;
}

/** A blank deal. Every field empty — no example name, price or products. */
export const EMPTY_DEAL: DealInput = {
  name: '',
  description: '',
  image: null,
  pricingType: 'fixed',
  price: null,
  percentOff: null,
  items: [],
  isPublished: false,
};

/**
 * Price a deal against the current menu.
 *
 * Fixed:      the operator's bundle price is what the customer pays.
 * Percentage: the discount is applied to the sum of the contents and rounded
 *             once, at the end, so no per-line rounding drift accumulates.
 */
export function priceDeal(
  record: DealRecord,
  menu: Map<ID, MenuItemWithPrices>,
): DealView {
  const items: DealItemView[] = record.items.map((line) => {
    const entry = menu.get(line.menuItemId);
    const size = line.sizeLabel;
    const unitPrice =
      entry && size && entry.prices[size] !== undefined
        ? entry.prices[size]
        : null;

    return {
      ...line,
      name: entry?.item.name,
      unitPrice: unitPrice ?? null,
      lineTotal: unitPrice === null ? null : unitPrice * line.quantity,
    };
  });

  const itemsTotal = items.reduce((sum, i) => sum + (i.lineTotal ?? 0), 0);

  // Every included product must still resolve to a real menu price.
  const isSellable =
    record.items.length > 0 && items.every((i) => i.unitPrice !== null);

  let dealPrice: Paisa;
  if (record.pricingType === 'percentage') {
    const percent = Math.min(100, Math.max(0, record.percentOff ?? 0));
    dealPrice = Math.round((itemsTotal * (100 - percent)) / 100);
  } else {
    dealPrice = Math.max(0, record.price ?? 0);
  }

  return {
    record,
    items,
    itemsTotal,
    dealPrice,
    savings: Math.max(0, itemsTotal - dealPrice),
    isSellable,
  };
}

async function menuIndex(): Promise<Map<ID, MenuItemWithPrices>> {
  const entries = await menuService.list();
  return new Map(entries.map((e) => [e.item.id, e]));
}

function normalise(input: DealInput) {
  return {
    name: input.name.trim(),
    description: input.description.trim(),
    image: input.image,
    pricingType: input.pricingType,
    // Only the field relevant to the chosen pricing type is stored, so a
    // stale value from the other mode can never be applied by accident.
    price: input.pricingType === 'fixed' ? Math.max(0, input.price ?? 0) : null,
    percentOff:
      input.pricingType === 'percentage'
        ? Math.min(100, Math.max(0, input.percentOff ?? 0))
        : null,
    items: input.items.filter((line) => line.quantity > 0),
    isPublished: input.isPublished ? (1 as const) : (0 as const),
  };
}

export const dealService = {
  priceDeal,

  /** Every deal, name-sorted, priced against the current menu. */
  async list(): Promise<DealView[]> {
    const [records, menu] = await Promise.all([
      dealsRepository.list(),
      menuIndex(),
    ]);

    return records
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      )
      .map((record) => priceDeal(record, menu));
  },

  /**
   * Deals the POS may sell: published, containing products, and with every
   * included product still resolving to a real price.
   */
  async listPublished(): Promise<DealView[]> {
    const all = await this.list();
    return all.filter(
      (view) => view.record.isPublished === 1 && view.isSellable,
    );
  },

  async getById(id: ID): Promise<DealView | undefined> {
    const record = await dealsRepository.getById(id);
    if (!record || record.deletedAt) return undefined;
    return priceDeal(record, await menuIndex());
  },

  async create(input: DealInput): Promise<DealRecord> {
    return dealsRepository.create(normalise(input));
  },

  async update(id: ID, input: DealInput): Promise<DealRecord> {
    return dealsRepository.update(id, normalise(input));
  },

  /** Publish or unpublish without touching anything else. */
  async setPublished(id: ID, published: boolean): Promise<DealRecord> {
    return dealsRepository.update(id, { isPublished: published ? 1 : 0 });
  },

  async remove(id: ID): Promise<void> {
    await dealsRepository.remove(id, { hard: true });
  },

  async count(): Promise<number> {
    return (await dealsRepository.list()).length;
  },
};
