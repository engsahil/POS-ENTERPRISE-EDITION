/**
 * Promise wrapper around IndexedDB — the application's system of record.
 *
 * Zero dependencies. All business data lives here so the terminal works
 * offline and survives refreshes, restarts and reboots. React state is only
 * ever a cache of what is stored here, never the source of truth.
 */

import {
  ALL_STORES,
  DB_NAME,
  DB_VERSION,
  type StoreName,
} from '@/config/storage.config';
import { runMigrations } from './migrations';

let dbPromise: Promise<IDBDatabase> | null = null;

function isSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function openDatabase(): Promise<IDBDatabase> {
  if (!isSupported()) {
    return Promise.reject(new Error('IndexedDB is not available.'));
  }

  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const transaction = request.transaction;
        if (!transaction) return;

        runMigrations({
          db: request.result,
          transaction,
          oldVersion: event.oldVersion,
          newVersion: event.newVersion ?? DB_VERSION,
        });
      };

      request.onsuccess = () => {
        const database = request.result;

        // Another tab is upgrading: release our handle so it can proceed.
        database.onversionchange = () => {
          database.close();
          dbPromise = null;
        };

        resolve(database);
      };

      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(
          new Error(
            'Database upgrade is blocked by another open tab. Close other tabs and reload.',
          ),
        );
    }).catch((error: unknown) => {
      dbPromise = null;
      throw error;
    });
  }

  return dbPromise;
}

async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const database = await openDatabase();
  const tx = database.transaction(storeName, mode);
  const result = await fn(tx.objectStore(storeName));
  await promisifyTransaction(tx);
  return result;
}

/**
 * Run a function across several stores inside a single atomic transaction.
 * Either every write lands or none of them do — required for operations like
 * "save order + its line items + the sale record".
 */
async function transaction<T>(
  storeNames: StoreName[],
  mode: IDBTransactionMode,
  fn: (stores: Record<string, IDBObjectStore>) => Promise<T> | T,
): Promise<T> {
  const database = await openDatabase();
  const tx = database.transaction(storeNames, mode);

  const stores: Record<string, IDBObjectStore> = {};
  for (const name of storeNames) {
    stores[name] = tx.objectStore(name);
  }

  const result = await fn(stores);
  await promisifyTransaction(tx);
  return result;
}

export const db = {
  isSupported,
  openDatabase,
  transaction,

  /** Low-level helper so callers inside a transaction can await requests. */
  request: promisifyRequest,

  get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
    return withStore(store, 'readonly', (s) =>
      promisifyRequest<T | undefined>(s.get(key) as IDBRequest<T | undefined>),
    );
  },

  getAll<T>(store: StoreName): Promise<T[]> {
    return withStore(store, 'readonly', (s) =>
      promisifyRequest<T[]>(s.getAll() as IDBRequest<T[]>),
    );
  },

  getAllByIndex<T>(
    store: StoreName,
    indexName: string,
    query?: IDBValidKey | IDBKeyRange,
  ): Promise<T[]> {
    return withStore(store, 'readonly', (s) =>
      promisifyRequest<T[]>(
        s.index(indexName).getAll(query) as IDBRequest<T[]>,
      ),
    );
  },

  getOneByIndex<T>(
    store: StoreName,
    indexName: string,
    query: IDBValidKey | IDBKeyRange,
  ): Promise<T | undefined> {
    return withStore(store, 'readonly', (s) =>
      promisifyRequest<T | undefined>(
        s.index(indexName).get(query) as IDBRequest<T | undefined>,
      ),
    );
  },

  countByIndex(
    store: StoreName,
    indexName: string,
    query?: IDBValidKey | IDBKeyRange,
  ): Promise<number> {
    return withStore(store, 'readonly', (s) =>
      promisifyRequest(s.index(indexName).count(query)),
    );
  },

  put<T>(store: StoreName, value: T): Promise<T> {
    return withStore(store, 'readwrite', async (s) => {
      await promisifyRequest(s.put(value as unknown as IDBValidKey));
      return value;
    });
  },

  /** Write many records atomically — all succeed or the transaction aborts. */
  putMany<T>(store: StoreName, values: T[]): Promise<T[]> {
    return withStore(store, 'readwrite', async (s) => {
      for (const value of values) {
        await promisifyRequest(s.put(value as unknown as IDBValidKey));
      }
      return values;
    });
  },

  remove(store: StoreName, key: IDBValidKey): Promise<void> {
    return withStore(store, 'readwrite', async (s) => {
      await promisifyRequest(s.delete(key));
    });
  },

  clear(store: StoreName): Promise<void> {
    return withStore(store, 'readwrite', async (s) => {
      await promisifyRequest(s.clear());
    });
  },

  count(store: StoreName): Promise<number> {
    return withStore(store, 'readonly', (s) => promisifyRequest(s.count()));
  },

  /** Record counts for every store — used by diagnostics. */
  async countAll(): Promise<Record<StoreName, number>> {
    const entries = await Promise.all(
      ALL_STORES.map(async (name) => [name, await db.count(name)] as const),
    );
    return Object.fromEntries(entries) as Record<StoreName, number>;
  },

  /**
   * Estimate of persisted bytes, where the browser exposes it.
   * Returns null when the Storage API is unavailable.
   */
  async estimateUsage(): Promise<{ usage: number; quota: number } | null> {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
      return null;
    }
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  },

  /**
   * Ask the browser to make storage persistent so it is not silently evicted
   * under disk pressure. Safe to call repeatedly.
   */
  async requestPersistence(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
      return false;
    }
    try {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  },
};

export type Database = typeof db;
