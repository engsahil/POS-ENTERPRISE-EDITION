/**
 * Inventory management.
 *
 * Stock lines are standalone: they can track anything (cups, flour, gas), and
 * may optionally be linked to a menu item. A linked line that is unavailable
 * or out of stock withholds its menu item from the POS.
 *
 * Nothing is ever seeded — no demo inventory, no fake quantities. A fresh
 * installation has zero stock lines.
 */

import { inventoryRepository } from '@/data/repositories';
import type { InventoryRecord, InventoryUnit } from '@/types/domain';
import type { ID } from '@/types/common';
import { clampStock, sanitiseText } from '@/utils/validate';

export const INVENTORY_UNITS: InventoryUnit[] = [
  'unit',
  'pack',
  'box',
  'bottle',
  'kg',
  'g',
  'litre',
  'ml',
];

/** Stock status derived from quantity, availability and the manual flag. */
export type StockStatus =
  | 'out-of-stock'
  | 'unavailable'
  | 'low-stock'
  | 'in-stock';

export interface InventoryItemView {
  record: InventoryRecord;
  status: StockStatus;
  /** True when this line should withhold its menu item from the POS. */
  blocksSale: boolean;
}

export interface InventoryInput {
  name: string;
  sku: string;
  unit: InventoryUnit;
  quantity: number;
  reorderLevel: number | null;
  menuItemId: ID | null;
  isAvailable: boolean;
}

/** A blank stock line. Quantity starts empty, never at a made-up figure. */
export const EMPTY_INVENTORY_INPUT: InventoryInput = {
  name: '',
  sku: '',
  unit: 'unit',
  quantity: 0,
  reorderLevel: null,
  menuItemId: null,
  isAvailable: true,
};

export function statusOf(record: InventoryRecord): StockStatus {
  if (record.isOutOfStock === 1 || record.quantity <= 0) return 'out-of-stock';
  if (record.isAvailable === 0) return 'unavailable';
  if (record.reorderLevel !== null && record.quantity <= record.reorderLevel) {
    return 'low-stock';
  }
  return 'in-stock';
}

function toView(record: InventoryRecord): InventoryItemView {
  const status = statusOf(record);
  return {
    record,
    status,
    blocksSale: status === 'out-of-stock' || status === 'unavailable',
  };
}

export const inventoryService = {
  /** Every stock line, name-sorted. Excludes soft-deleted rows. */
  async list(): Promise<InventoryItemView[]> {
    const records = await inventoryRepository.list();
    return records
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      )
      .map(toView);
  },

  async getById(id: ID): Promise<InventoryItemView | undefined> {
    const record = await inventoryRepository.getById(id);
    if (!record || record.deletedAt) return undefined;
    return toView(record);
  },

  /** Stock line linked to a given menu item, if any. */
  async findByMenuItem(menuItemId: ID): Promise<InventoryItemView | undefined> {
    const matches = await inventoryRepository.findByIndex(
      'by_menuItemId',
      menuItemId,
    );
    const record = matches[0];
    return record ? toView(record) : undefined;
  },

  /**
   * Menu item IDs that must be withheld from the POS because their linked
   * stock line is out of stock or switched unavailable.
   */
  async blockedMenuItemIds(): Promise<Set<ID>> {
    const views = await this.list();
    const blocked = new Set<ID>();
    for (const view of views) {
      if (view.blocksSale && view.record.menuItemId) {
        blocked.add(view.record.menuItemId);
      }
    }
    return blocked;
  },

  async create(input: InventoryInput): Promise<InventoryRecord> {
    // clampStock rejects NaN/Infinity, which previously reached storage.
    const quantity = clampStock(input.quantity);
    return inventoryRepository.create({
      name: sanitiseText(input.name, 120),
      sku: sanitiseText(input.sku, 60),
      unit: input.unit,
      quantity,
      reorderLevel:
        input.reorderLevel === null ? null : clampStock(input.reorderLevel),
      menuItemId: input.menuItemId,
      isAvailable: input.isAvailable ? 1 : 0,
      // A line created with zero quantity is out of stock from the start.
      isOutOfStock: quantity <= 0 ? 1 : 0,
      quantityBeforeOutOfStock: null,
    });
  },

  async update(id: ID, input: InventoryInput): Promise<InventoryRecord> {
    const quantity = clampStock(input.quantity);
    return inventoryRepository.update(id, {
      name: sanitiseText(input.name, 120),
      sku: sanitiseText(input.sku, 60),
      unit: input.unit,
      quantity,
      reorderLevel:
        input.reorderLevel === null ? null : clampStock(input.reorderLevel),
      menuItemId: input.menuItemId,
      isAvailable: input.isAvailable ? 1 : 0,
      // Editing the quantity above zero clears a manual out-of-stock mark.
      isOutOfStock: quantity <= 0 ? 1 : 0,
      quantityBeforeOutOfStock: quantity > 0 ? null : undefined,
    } as Partial<InventoryRecord>);
  },

  /** Set quantity directly. Negative values are clamped to zero. */
  async setQuantity(id: ID, quantity: number): Promise<InventoryRecord> {
    const next = clampStock(quantity);
    return inventoryRepository.update(id, {
      quantity: next,
      isOutOfStock: next <= 0 ? 1 : 0,
      quantityBeforeOutOfStock: next > 0 ? null : undefined,
    } as Partial<InventoryRecord>);
  },

  /** Operator availability switch, independent of quantity. */
  async setAvailable(id: ID, available: boolean): Promise<InventoryRecord> {
    return inventoryRepository.update(id, { isAvailable: available ? 1 : 0 });
  },

  /**
   * Mark out of stock, remembering the quantity so it can be restored.
   * Quantity drops to zero; the previous figure is preserved.
   */
  async markOutOfStock(id: ID): Promise<InventoryRecord> {
    const record = await inventoryRepository.getById(id);
    if (!record) throw new Error('Stock line not found.');

    return inventoryRepository.update(id, {
      isOutOfStock: 1,
      quantity: 0,
      // Only capture the previous quantity the first time.
      quantityBeforeOutOfStock:
        record.quantityBeforeOutOfStock ??
        (record.quantity > 0 ? record.quantity : null),
    } as Partial<InventoryRecord>);
  },

  /**
   * Restore stock after an out-of-stock mark.
   * Uses the remembered quantity unless an explicit one is supplied.
   */
  async restoreStock(id: ID, quantity?: number): Promise<InventoryRecord> {
    const record = await inventoryRepository.getById(id);
    if (!record) throw new Error('Stock line not found.');

    const restored =
      quantity !== undefined
        ? clampStock(quantity)
        : clampStock(record.quantityBeforeOutOfStock ?? 0);

    return inventoryRepository.update(id, {
      quantity: restored,
      isOutOfStock: restored > 0 ? 0 : 1,
      quantityBeforeOutOfStock: null,
    } as Partial<InventoryRecord>);
  },

  async remove(id: ID): Promise<void> {
    await inventoryRepository.remove(id, { hard: true });
  },

  /** Menu item IDs already linked, so the picker cannot double-link one. */
  async linkedMenuItemIds(excludeId?: ID): Promise<Set<ID>> {
    const records = await inventoryRepository.list();
    const used = new Set<ID>();
    for (const record of records) {
      if (record.id === excludeId) continue;
      if (record.menuItemId) used.add(record.menuItemId);
    }
    return used;
  },

  async count(): Promise<number> {
    return (await inventoryRepository.list()).length;
  },
};
