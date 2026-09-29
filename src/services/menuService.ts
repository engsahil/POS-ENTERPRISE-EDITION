/**
 * Menu management.
 *
 * A menu item is stored as one `menuItems` record plus one `itemPrices` row
 * per offered variant. Food items are priced in the standard sizes
 * (Small / Medium / Large / Extra Large / XL); cold drinks are priced in
 * volume labels (250 ml, 330 ml, 500 ml / Half Liter, 1 Liter, 1.5 Liter).
 * Both sets use the same variant/price rows, so nothing about the storage
 * or sale flow changes — only which labels an item offers. Prices live in
 * their own store so cost prices or per-size stock can be added later
 * without reshaping the item record.
 *
 * Nothing is ever seeded: no default products, no demo items, no sample
 * prices. An unconfigured terminal has zero menu items.
 */

import { db } from '@/data/db/indexedDb';
import { STORES } from '@/config/storage.config';
import { menuItemsRepository, itemPricesRepository } from '@/data/repositories';
import type {
  ItemPriceRecord,
  MenuItemRecord,
  StoredImage,
  VariantKind,
} from '@/types/domain';
import type { ID, Paisa } from '@/types/common';
import { sanitisePrice, sanitiseText } from '@/utils/validate';

export type { VariantKind };

/** Food sizes, in display order. */
export const SIZES = ['Small', 'Medium', 'Large', 'Extra Large', 'XL'] as const;
export type SizeLabel = (typeof SIZES)[number];

/** Volume options for cold drinks / beverages, in display order. */
export const VOLUME_SIZES = [
  '250 ml',
  '330 ml',
  '500 ml / Half Liter',
  '1 Liter',
  '1.5 Liter',
] as const;
export type VolumeLabel = (typeof VOLUME_SIZES)[number];

/** Any selectable variant label. */
export type VariantLabel = SizeLabel | VolumeLabel;

/** Every known label, food sizes first — the canonical display order. */
export const VARIANT_LABELS: readonly VariantLabel[] = [...SIZES, ...VOLUME_SIZES];

/** The label set an item of the given kind offers. */
export function labelsForKind(kind: VariantKind): readonly VariantLabel[] {
  return kind === 'volume' ? VOLUME_SIZES : SIZES;
}

/**
 * Compact badge for a label where space is tight (POS tiles, list rows).
 * The classic single letters stay single letters; longer labels — Extra
 * Large, XL and the volume options — are shown in full so they are never
 * confused with each other.
 */
export function sizeBadgeLabel(label: VariantLabel): string {
  switch (label) {
    case 'Small':
      return 'S';
    case 'Medium':
      return 'M';
    case 'Large':
      return 'L';
    default:
      return label;
  }
}

/** Prices keyed by variant label. `null` means "not offered in this label". */
export type SizePrices = Record<VariantLabel, Paisa | null>;

export const EMPTY_SIZE_PRICES: SizePrices = {
  Small: null,
  Medium: null,
  Large: null,
  'Extra Large': null,
  XL: null,
  '250 ml': null,
  '330 ml': null,
  '500 ml / Half Liter': null,
  '1 Liter': null,
  '1.5 Liter': null,
};

/** A menu item joined with its size prices — what the UI and POS consume. */
export interface MenuItemWithPrices {
  item: MenuItemRecord;
  prices: SizePrices;
  /** Lowest priced size, or null when the item has no prices yet. */
  fromPrice: Paisa | null;
  /** Variant labels that actually have a price, in display order. */
  availableSizes: VariantLabel[];
}

export interface MenuItemInput {
  name: string;
  category: string;
  description: string;
  image: StoredImage | null;
  isActive: boolean;
  /** Which label set the item is priced in: food sizes or drink volumes. */
  variantKind: VariantKind;
  prices: SizePrices;
}

/** A blank item — every field empty. Used for the "Add item" form. */
export const EMPTY_MENU_ITEM: MenuItemInput = {
  name: '',
  category: '',
  description: '',
  image: null,
  isActive: true,
  variantKind: 'size',
  prices: { ...EMPTY_SIZE_PRICES },
};

/**
 * Prices for labels outside the item's active kind are forced to null, so
 * an item can never end up offering both food sizes and volumes at once.
 */
function pricesForKind(kind: VariantKind, prices: SizePrices): SizePrices {
  const result: SizePrices = { ...EMPTY_SIZE_PRICES, ...prices };
  const offered = labelsForKind(kind);
  for (const label of VARIANT_LABELS) {
    if (!offered.includes(label)) result[label] = null;
  }
  return result;
}

function summarise(
  item: MenuItemRecord,
  priceRows: ItemPriceRecord[],
): MenuItemWithPrices {
  const kind: VariantKind = item.variantKind === 'volume' ? 'volume' : 'size';
  const prices: SizePrices = { ...EMPTY_SIZE_PRICES };

  for (const row of priceRows) {
    if (row.deletedAt) continue;
    if ((VARIANT_LABELS as readonly string[]).includes(row.label)) {
      prices[row.label as VariantLabel] = row.price;
    }
  }

  // Only the active kind's labels are ever offered for sale.
  const normalised = pricesForKind(kind, prices);
  const availableSizes = VARIANT_LABELS.filter((s) => normalised[s] !== null);
  const values = availableSizes.map((s) => normalised[s] as Paisa);

  return {
    item,
    prices: normalised,
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
      variantKind: input.variantKind === 'volume' ? 'volume' : 'size',
    });

    await this.replacePrices(
      item.id,
      pricesForKind(
        input.variantKind === 'volume' ? 'volume' : 'size',
        input.prices,
      ),
    );
    return (await this.getById(item.id)) as MenuItemWithPrices;
  },

  async update(id: ID, input: MenuItemInput): Promise<MenuItemWithPrices> {
    const variantKind: VariantKind =
      input.variantKind === 'volume' ? 'volume' : 'size';
    await menuItemsRepository.update(id, {
      name: sanitiseText(input.name, 120),
      category: sanitiseText(input.category, 60),
      description: sanitiseText(input.description, 500),
      image: input.image,
      isActive: input.isActive ? 1 : 0,
      variantKind,
    });

    await this.replacePrices(id, pricesForKind(variantKind, input.prices));
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
   * create missing ones, and hard-delete labels that no longer have a price.
   * Every known label is considered, so clearing a size or switching an
   * item's kind removes the now-unused rows rather than orphaning them.
   */
  async replacePrices(menuItemId: ID, prices: SizePrices): Promise<void> {
    const existing = await itemPricesRepository.findByIndex(
      'by_menuItemId',
      menuItemId,
      { includeDeleted: true },
    );
    const bySize = new Map(existing.map((row) => [row.label, row]));

    for (const size of VARIANT_LABELS) {
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
          sortOrder: VARIANT_LABELS.indexOf(size),
        } as Partial<ItemPriceRecord>);
      } else {
        await itemPricesRepository.create({
          menuItemId,
          label: size,
          price: value,
          isDefault: 0,
          sortOrder: VARIANT_LABELS.indexOf(size),
        });
      }
    }
  },

  async count(): Promise<number> {
    return (await menuItemsRepository.list()).length;
  },
};
