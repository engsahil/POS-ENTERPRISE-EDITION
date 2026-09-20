/**
 * Settings persistence.
 *
 * Each setting is its own record keyed by name, so adding a preference never
 * requires a schema change and concurrent writes cannot clobber each other.
 */

import { settingsRepository } from '@/data/repositories';
import type { SettingRecord } from '@/types/domain';

export const SETTING_KEYS = {
  /** Incrementing counter behind human-readable order numbers. */
  orderSequence: 'order.sequence',
  /** Whether the browser granted persistent storage. */
  storagePersisted: 'storage.persisted',
  /** Default thermal paper width ('58mm' | '80mm'). */
  receiptWidth: 'receipt.width',
  /** Automatically open the receipt after completing an order. */
  autoShowReceipt: 'receipt.autoShow',
  /** Prefix applied in front of generated order numbers. */
  orderNumberPrefix: 'order.numberPrefix',
  /** Quantity at or below which inventory is flagged low by default. */
  lowStockDefault: 'inventory.lowStockDefault',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export const settingsService = {
  async get<T>(key: string, fallback: T): Promise<T> {
    const record = await settingsRepository.getById(key);
    if (!record || record.deletedAt) return fallback;
    return record.value as T;
  },

  async set<T>(key: string, value: T): Promise<SettingRecord<T>> {
    const existing = await settingsRepository.getById(key);

    if (existing) {
      const updated = await settingsRepository.update(key, {
        value,
        deletedAt: null,
      } as Partial<SettingRecord>);
      return updated as SettingRecord<T>;
    }

    const created = await settingsRepository.create({ id: key, value });
    return created as SettingRecord<T>;
  },

  async remove(key: string): Promise<void> {
    await settingsRepository.remove(key, { hard: true });
  },

  async all(): Promise<SettingRecord[]> {
    return settingsRepository.list();
  },
};
