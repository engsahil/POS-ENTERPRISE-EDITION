/**
 * Menu management.
 *
 * A menu item is stored as one `menuItems` record plus up to three
 * `itemPrices` rows (Small / Medium / Large). Prices live in their own store
 * so a future step can add sizes, cost prices or per-size stock without
 * reshaping the item record.
 *
 * Nothing is ever seeded: no default products, no demo items, no sample
 * prices. An unconfigured terminal has zero menu items.
 */

import { db } from '@/data/db/indexedDb';
import { STORES } from '@/config/storage.config';
import { menuItemsRepository, itemPricesRepository } from '@/data/repositories';
import type { ItemPriceRecord, MenuItemRecord, StoredImage } from '@/types/domain';
import type { ID, Paisa } from '@/types/common';
import { sanitisePrice, sanitiseText } from '@/utils/validate';

/** The three sizes, in display order. */
export const SIZES = ['Small', 'Medium', 'Large'] as const;
export type SizeLabel = (typeof SIZES)[number];

/** Prices keyed by size. `null` means "not offered in this size". */
export type SizePrices = Record<SizeLabel, Paisa | null>;

export const EMPTY_SIZE_PRICES: SizePrices = {
  Small: null,
  Medium: null,
  Large: null,
};

/** A menu item joined with its size prices — what the UI and POS consume. */
export interface MenuItemWithPrices {
  item: MenuItemRecord;
  prices: SizePrices;
  /** Lowest priced size, or null when the item has no prices yet. */
  fromPrice: Paisa | null;
  /** Sizes that actually have a price, in display order. */
  availableSizes: SizeLabel[];
}

export interface MenuItemInput {
  name: string;
  category: string;
  description: string;
  image: StoredImage | null;
  isActive: boolean;
  prices: SizePrices;
}

/** A blank item — every field empty. Used for the "Add item" form. */
export const EMPTY_MENU_ITEM: MenuItemInput = {
  name: '',
  category: '',
  description: '',
  image: null,
  isActive: true,
  prices: { ...EMPTY_SIZE_PRICES },
};

function summarise(
  item: MenuItemRecord,
  priceRows: ItemPriceRecord[],
): MenuItemWithPrices {
  const prices: SizePrices = { ...EMPTY_SIZE_PRICES };

  for (const row of priceRows) {
    if (row.deletedAt) continue;
    if ((SIZES as readonly string[]).includes(row.label)) {
      prices[row.label as SizeLabel] = row.price;
    }
  }

  const availableSizes = SIZES.filter((s) => prices[s] !== null);
  const values = availableSizes.map((s) => prices[s] as Paisa);

  return {
    item,
    prices,
    fromPrice: values.length ? Math.min(...values) : null,
    availableSizes,
  };
}

export const menuService = {
  /** Every menu item with its prices, name-sorted. Excludes deleted items. */
  async list(): Promise<MenuItemWithPrices[]> {
    const [items, allPrices] = await Promise.all([
      menuItemsRepository.list(),
      itemPricesRepository.list(),
    ]);

    const byItem = new Map<ID, ItemPriceRecord[]>();
    for (const row of allPrices) {
      const list = byItem.get(row.menuItemId);
      if (list) list.push(row);
      else byItem.set(row.menuItemId, [row]);
    }

    return items
      .map((item) => summarise(item, byItem.get(item.id) ?? []))
      .sort((a, b) =>
        a.item.name.localeCompare(b.item.name, undefined, {
          sensitivity: 'base',
        }),
      );
  },

  /** Only items available for sale — what the POS should show. */
  async listActive(): Promise<MenuItemWithPrices[]> {
    const all = await this.list();
    return all.filter((entry) => entry.item.isActive === 1);
  },

  async getById(id: ID): Promise<MenuItemWithPrices | undefined> {
    const item = await menuItemsRepository.getById(id);
    if (!item || item.deletedAt) return undefined;
    const priceRows = await itemPricesRepository.findByIndex(
      'by_menuItemId',
      id,
    );
    return summarise(item, priceRows);
  },

  /** Distinct categories currently in use, for the category suggestions. */
  async categories(): Promise<string[]> {
    const items = await menuItemsRepository.list();
    const set = new Set<string>();
    for (const item of items) {
      const value = item.category?.trim();
      if (value) set.add(value);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
  },

  async create(input: MenuItemInput): Promise<MenuItemWithPrices> {
    const item = await menuItemsRepository.create({
      name: sanitiseText(input.name, 120),
      category: sanitiseText(input.category, 60),
      description: sanitiseText(input.description, 500),
      image: input.image,
      isActive: input.isActive ? 1 : 0,
      tracksInventory: 0,
    });

    await this.replacePrices(item.id, input.prices);
    return (await this.getById(item.id)) as MenuItemWithPrices;
  },

  async update(id: ID, input: MenuItemInput): Promise<MenuItemWithPrices> {
    await menuItemsRepository.update(id, {
      name: sanitiseText(input.name, 120),
      category: sanitiseText(input.category, 60),
      description: sanitiseText(input.description, 500),
      image: input.image,
      isActive: input.isActive ? 1 : 0,
    });

    await this.replacePrices(id, input.prices);
    return (await this.getById(id)) as MenuItemWithPrices;
  },

  /** Toggle availability without touching anything else. */
  async setActive(id: ID, active: boolean): Promise<MenuItemRecord> {
    return menuItemsRepository.update(id, { isActive: active ? 1 : 0 });
  },

  /**
   * Delete an item and its price rows in a single atomic transaction, so a
   * failure can never leave orphaned prices behind.
   */
  async remove(id: ID): Promise<void> {
    const priceRows = await itemPricesRepository.findByIndex(
      'by_menuItemId',
      id,
      { includeDeleted: true },
    );

    await db.transaction(
      [STORES.menuItems, STORES.itemPrices],
      'readwrite',
      async (stores) => {
        const itemStore = stores[STORES.menuItems];
        const priceStore = stores[STORES.itemPrices];
        if (!itemStore || !priceStore) {
          throw new Error('Menu stores are unavailable.');
        }

        await db.request(itemStore.delete(id));
        for (const row of priceRows) {
          await db.request(priceStore.delete(row.id));
        }
      },
    );
  },

  /**
   * Make the stored price rows match `prices` exactly: update existing rows,
   * create missing ones, and hard-delete sizes that no longer have a price.
   */
  async replacePrices(menuItemId: ID, prices: SizePrices): Promise<void> {
    const existing = await itemPricesRepository.findByIndex(
      'by_menuItemId',
      menuItemId,
      { includeDeleted: true },
    );
    const bySize = new Map(existing.map((row) => [row.label, row]));

    for (const size of SIZES) {
      // sanitisePrice turns NaN/Infinity/negative into null (= not offered),
      // so an invalid price can never be stored or later summed.
      const value = sanitisePrice(prices[size]);
      const row = bySize.get(size);

      if (value === null) {
        if (row) await itemPricesRepository.remove(row.id, { hard: true });
        continue;
      }

      if (row) {
        await itemPricesRepository.update(row.id, {
          price: value,
          deletedAt: null,
          sortOrder: SIZES.indexOf(size),
        } as Partial<ItemPriceRecord>);
      } else {
        await itemPricesRepository.create({
          menuItemId,
          label: size,
          price: value,
          isDefault: 0,
          sortOrder: SIZES.indexOf(size),
        });
      }
    }
  },

  async count(): Promise<number> {
    return (await menuItemsRepository.list()).length;
  },
};
