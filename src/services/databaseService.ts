/**
 * Database lifecycle: startup, diagnostics and reset.
 *
 * The database starts completely empty. Nothing is seeded except the admin
 * credential record created on first sign-in bootstrap — no demo products,
 * no sample orders, no placeholder restaurant.
 */

import { ALL_STORES, DB_NAME, DB_VERSION, STORES } from '@/config/storage.config';
import type { StoreName } from '@/config/storage.config';
import { db } from '@/data/db/indexedDb';
import { repositories } from '@/data/repositories';
import { settingsService, SETTING_KEYS } from './settingsService';

export interface StorageDiagnostics {
  supported: boolean;
  name: string;
  version: number;
  /** True once the browser has granted persistent (non-evictable) storage. */
  persisted: boolean;
  counts: Record<StoreName, number>;
  totalRecords: number;
  usage: number | null;
  quota: number | null;
}

export const databaseService = {
  /**
   * Open the database, apply migrations and request persistent storage.
   * Safe to call more than once.
   */
  async initialise(): Promise<{ ok: boolean; error?: string }> {
    if (!db.isSupported()) {
      return {
        ok: false,
        error: 'This browser does not support IndexedDB.',
      };
    }

    try {
      await db.openDatabase();

      // Ask the browser not to evict our data under disk pressure.
      const persisted = await db.requestPersistence();
      await settingsService.set(SETTING_KEYS.storagePersisted, persisted);

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to open the local database.',
      };
    }
  },

  async diagnostics(): Promise<StorageDiagnostics> {
    const supported = db.isSupported();

    if (!supported) {
      const empty = Object.fromEntries(
        ALL_STORES.map((s) => [s, 0]),
      ) as Record<StoreName, number>;
      return {
        supported: false,
        name: DB_NAME,
        version: DB_VERSION,
        persisted: false,
        counts: empty,
        totalRecords: 0,
        usage: null,
        quota: null,
      };
    }

    const counts = await db.countAll();
    const estimate = await db.estimateUsage();
    const persisted =
      typeof navigator !== 'undefined' && navigator.storage?.persisted
        ? await navigator.storage.persisted()
        : false;

    return {
      supported: true,
      name: DB_NAME,
      version: DB_VERSION,
      persisted,
      counts,
      totalRecords: Object.values(counts).reduce((sum, n) => sum + n, 0),
      usage: estimate?.usage ?? null,
      quota: estimate?.quota ?? null,
    };
  },

  /**
   * Wipe business data. The admin account is preserved by default so the
   * operator is not locked out of their own terminal.
   */
  async resetData(
    options: { includeAdmin?: boolean } = {},
  ): Promise<{ cleared: StoreName[] }> {
    const cleared: StoreName[] = [];

    for (const name of ALL_STORES) {
      if (name === STORES.admin && !options.includeAdmin) continue;
      await repositories[name].clear();
      cleared.push(name);
    }

    return { cleared };
  },
};
