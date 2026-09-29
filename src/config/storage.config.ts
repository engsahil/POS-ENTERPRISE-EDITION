/**
 * Storage configuration: database identity, versioning and object stores.
 *
 * IndexedDB is the system of record for this application. Every business
 * entity is persisted here so the terminal keeps working offline and data
 * survives refreshes, restarts and device reboots.
 *
 * To evolve the schema: add/extend a store below, bump DB_VERSION, and add a
 * migration step to MIGRATIONS. Never mutate an existing migration that has
 * already shipped.
 */

export const DB_NAME = 'pos-db';

/**
 * v1 — foundation stores (products, categories, orders, settings, outbox)
 * v2 — full domain schema for offline-first operation
 * v6 — customers store, by_customerId index on orders
 */
export const DB_VERSION = 6;

export const STORES = {
  admin: 'admin',
  restaurant: 'restaurant',
  menuItems: 'menuItems',
  itemPrices: 'itemPrices',
  inventory: 'inventory',
  deals: 'deals',
  orders: 'orders',
  orderItems: 'orderItems',
  sales: 'sales',
  customers: 'customers',
  toppings: 'toppings',
  addOns: 'addOns',
  settings: 'settings',
  syncQueue: 'syncQueue',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export const ALL_STORES: StoreName[] = Object.values(STORES);

export interface IndexDefinition {
  name: string;
  keyPath: string | string[];
  unique?: boolean;
  multiEntry?: boolean;
}

export interface StoreSchema {
  name: StoreName;
  keyPath: string;
  autoIncrement?: boolean;
  indexes?: IndexDefinition[];
  /** Documentation only — describes what the store holds. */
  description: string;
}

/**
 * Structural definitions only. Every store is keyed by a stable string `id`
 * and indexed on `updatedAt` so a future sync engine can pull deltas.
 */
export const STORE_SCHEMAS: StoreSchema[] = [
  {
    name: STORES.admin,
    keyPath: 'id',
    description: 'Administrator accounts and hashed credentials.',
    indexes: [
      { name: 'by_username', keyPath: 'username', unique: true },
      { name: 'by_updatedAt', keyPath: 'updatedAt' },
    ],
  },
  {
    name: STORES.restaurant,
    keyPath: 'id',
    description: 'Restaurant profile: name, contact, address, tax settings.',
    indexes: [{ name: 'by_updatedAt', keyPath: 'updatedAt' }],
  },
  {
    name: STORES.menuItems,
    keyPath: 'id',
    description: 'Menu items available for sale.',
    indexes: [
      { name: 'by_category', keyPath: 'category' },
      { name: 'by_name', keyPath: 'name' },
      { name: 'by_isActive', keyPath: 'isActive' },
      { name: 'by_updatedAt', keyPath: 'updatedAt' },
    ],
  },
  {
    name: STORES.itemPrices,
    keyPath: 'id',
    description: 'Size/variant rows with prices, linked to a menu item.',
    indexes: [
      { name: 'by_menuItemId', keyPath: 'menuItemId' },
      { name: 'by_updatedAt', keyPath: 'updatedAt' },
    ],
  },
  {
    name: STORES.inventory,
    keyPath: 'id',
    description: 'Stock levels and stock movements per tracked item.',
    indexes: [
      { name: 'by_menuItemId', keyPath: 'menuItemId' },
      { name: 'by_sku', keyPath: 'sku' },
      { name: 'by_name', keyPath: 'name' },
      { name: 'by_updatedAt', keyPath: 'updatedAt' },
    ],
  },
  {
    name: STORES.deals,
    keyPath: 'id',
    description: 'Combo deals and discount offers.',
    indexes: [
      { name: 'by_isPublished', keyPath: 'isPublished' },
      { name: 'by_name', keyPath: 'name' },
      { name: 'by_updatedAt', keyPath: 'updatedAt' },
    ],
  },
  {
    name: STORES.orders,
    keyPath: 'id',
    description: 'Order headers: totals, status, payment.',
    indexes: [
      { name: 'by_orderNumber', keyPath: 'orderNumber', unique: true },
      { name: 'by_status', keyPath: 'status' },
      { name: 'by_customerId', keyPath: 'customerId' },
      { name: 'by_createdAt', keyPath: 'createdAt' },
      { name: 'by_updatedAt', keyPath: 'updatedAt' },
    ],
  },
  {
    name: STORES.orderItems,
    keyPath: 'id',
    description: 'Line items belonging to an order.',
    indexes: [
      { name: 'by_orderId', keyPath: 'orderId' },
      { name: 'by_menuItemId', keyPath: 'menuItemId' },
      { name: 'by_updatedAt', keyPath: 'updatedAt' },
    ],
  },
  {
    name: STORES.sales,
    keyPath: 'id',
    description: 'Completed sale records for reporting.',
    indexes: [
      { name: 'by_orderId', keyPath: 'orderId', unique: true },
      { name: 'by_businessDate', keyPath: 'businessDate' },
      { name: 'by_completedAt', keyPath: 'completedAt' },
      { name: 'by_updatedAt', keyPath: 'updatedAt' },
    ],
  },
  {
    name: STORES.customers,
    keyPath: 'id',
    description: 'Customer records shared across orders and history.',
    indexes: [
      { name: 'by_phoneKey', keyPath: 'phoneKey' },
      { name: 'by_updatedAt', keyPath: 'updatedAt' },
    ],
  },
  {
    name: STORES.toppings,
    keyPath: 'id',
    description: 'Optional toppings with extra price.',
    indexes: [
      { name: 'by_name', keyPath: 'name' },
      { name: 'by_isActive', keyPath: 'isActive' },
      { name: 'by_updatedAt', keyPath: 'updatedAt' },
    ],
  },
  {
    name: STORES.addOns,
    keyPath: 'id',
    description: 'Optional add-ons with extra price.',
    indexes: [
      { name: 'by_name', keyPath: 'name' },
      { name: 'by_isActive', keyPath: 'isActive' },
      { name: 'by_updatedAt', keyPath: 'updatedAt' },
    ],
  },
  {
    name: STORES.settings,
    keyPath: 'id',
    description: 'Application settings as individual keyed records.',
    indexes: [{ name: 'by_updatedAt', keyPath: 'updatedAt' }],
  },
  {
    name: STORES.syncQueue,
    keyPath: 'id',
    description: 'Queued local mutations awaiting upload to a backend.',
    indexes: [
      { name: 'by_status', keyPath: 'status' },
      { name: 'by_entity', keyPath: 'entity' },
      { name: 'by_createdAt', keyPath: 'createdAt' },
    ],
  },
];

/**
 * Stores that existed in v1 and are no longer part of the schema.
 * Removed during migration so the database does not accumulate dead stores.
 */
export const RETIRED_STORES = ['products', 'categories', 'outbox', 'license'] as const;

export const LOCAL_STORAGE_KEYS = {
  lastRoute: 'pos.lastRoute',
} as const;
