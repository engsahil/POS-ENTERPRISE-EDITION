/**
 * Repository registry — one typed repository per persistent store.
 *
 * Feature steps import these instead of touching IndexedDB directly, so all
 * persistence goes through the same timestamped, soft-delete-aware path.
 */

import { STORES } from '@/config/storage.config';
import type {
  AddOnRecord,
  AdminRecord,
  CustomerRecord,
  DealRecord,
  InventoryRecord,
  ItemPriceRecord,
  MenuItemRecord,
  OrderItemRecord,
  OrderRecord,
  RestaurantRecord,
  SaleRecord,
  SettingRecord,
  SyncQueueRecord,
  ToppingRecord,
} from '@/types/domain';
import { createRepository, type Repository } from './createRepository';

export type {
  EntityInput,
  ListOptions,
  Repository,
} from './createRepository';
export { buildEntity, createRepository } from './createRepository';

export const adminRepository: Repository<AdminRecord> =
  createRepository<AdminRecord>(STORES.admin);

export const restaurantRepository: Repository<RestaurantRecord> =
  createRepository<RestaurantRecord>(STORES.restaurant);

export const menuItemsRepository: Repository<MenuItemRecord> =
  createRepository<MenuItemRecord>(STORES.menuItems);

export const itemPricesRepository: Repository<ItemPriceRecord> =
  createRepository<ItemPriceRecord>(STORES.itemPrices);

export const inventoryRepository: Repository<InventoryRecord> =
  createRepository<InventoryRecord>(STORES.inventory);

export const dealsRepository: Repository<DealRecord> =
  createRepository<DealRecord>(STORES.deals);

export const ordersRepository: Repository<OrderRecord> =
  createRepository<OrderRecord>(STORES.orders);

export const orderItemsRepository: Repository<OrderItemRecord> =
  createRepository<OrderItemRecord>(STORES.orderItems);

export const salesRepository: Repository<SaleRecord> =
  createRepository<SaleRecord>(STORES.sales);

export const customersRepository: Repository<CustomerRecord> =
  createRepository<CustomerRecord>(STORES.customers);

export const toppingsRepository: Repository<ToppingRecord> =
  createRepository<ToppingRecord>(STORES.toppings);

export const addOnsRepository: Repository<AddOnRecord> =
  createRepository<AddOnRecord>(STORES.addOns);

export const settingsRepository: Repository<SettingRecord> =
  createRepository<SettingRecord>(STORES.settings);

export const syncQueueRepository: Repository<SyncQueueRecord> =
  createRepository<SyncQueueRecord>(STORES.syncQueue);

/** Every repository, keyed by store name — used by diagnostics and reset. */
export const repositories = {
  [STORES.admin]: adminRepository,
  [STORES.restaurant]: restaurantRepository,
  [STORES.menuItems]: menuItemsRepository,
  [STORES.itemPrices]: itemPricesRepository,
  [STORES.inventory]: inventoryRepository,
  [STORES.deals]: dealsRepository,
  [STORES.orders]: ordersRepository,
  [STORES.orderItems]: orderItemsRepository,
  [STORES.sales]: salesRepository,
  [STORES.customers]: customersRepository,
  [STORES.toppings]: toppingsRepository,
  [STORES.addOns]: addOnsRepository,
  [STORES.settings]: settingsRepository,
  [STORES.syncQueue]: syncQueueRepository,
} as const;
