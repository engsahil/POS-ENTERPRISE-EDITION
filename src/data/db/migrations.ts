/**
 * Schema migrations.
 *
 * Each migration is applied inside IndexedDB's `versionchange` transaction
 * when a device opens a database older than DB_VERSION. Migrations are
 * additive and idempotent so upgrading never destroys existing records.
 *
 * Rule: never edit a migration that has already shipped — add a new one.
 */

import {
  RETIRED_STORES,
  STORE_SCHEMAS,
  type StoreSchema,
} from '@/config/storage.config';

export interface MigrationContext {
  db: IDBDatabase;
  transaction: IDBTransaction;
  oldVersion: number;
  newVersion: number;
}

/** Create a store (and its indexes) if it does not already exist. */
function ensureStore(ctx: MigrationContext, schema: StoreSchema): void {
  const { db, transaction } = ctx;

  const store = db.objectStoreNames.contains(schema.name)
    ? transaction.objectStore(schema.name)
    : db.createObjectStore(schema.name, {
        keyPath: schema.keyPath,
        autoIncrement: schema.autoIncrement ?? false,
      });

  for (const index of schema.indexes ?? []) {
    if (store.indexNames.contains(index.name)) continue;
    store.createIndex(index.name, index.keyPath, {
      unique: index.unique ?? false,
      multiEntry: index.multiEntry ?? false,
    });
  }
}

export interface Migration {
  version: number;
  description: string;
  run: (ctx: MigrationContext) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial foundation stores.',
    run: () => {
      // v1 stores are superseded by v2; nothing to do on a fresh install.
    },
  },
  {
    version: 2,
    description:
      'Full domain schema: admin, restaurant, menu, prices, inventory, ' +
      'deals, orders, order items, sales, license, settings, sync queue.',
    run: (ctx) => {
      for (const schema of STORE_SCHEMAS) {
        ensureStore(ctx, schema);
      }

      // Drop v1 stores that are no longer part of the schema. They were
      // never populated with real data (no demo records were ever seeded).
      for (const name of RETIRED_STORES) {
        if (ctx.db.objectStoreNames.contains(name)) {
          ctx.db.deleteObjectStore(name);
        }
      }
    },
  },
  {
    version: 3,
    description: 'Inventory management: add the by_name index on inventory.',
    run: (ctx) => {
      // ensureStore only adds what is missing, so this both upgrades an
      // existing v2 database and is a no-op on a fresh install.
      for (const schema of STORE_SCHEMAS) {
        ensureStore(ctx, schema);
      }
    },
  },
  {
    version: 4,
    description:
      'Deals: publish flag replaces isActive, plus by_name. Drops the stale ' +
      'by_isActive index, which pointed at a field that no longer exists.',
    run: (ctx) => {
      const { db, transaction } = ctx;

      if (db.objectStoreNames.contains('deals')) {
        const deals = transaction.objectStore('deals');
        // An index on a removed field would silently never match.
        if (deals.indexNames.contains('by_isActive')) {
          deals.deleteIndex('by_isActive');
        }
      }

      for (const schema of STORE_SCHEMAS) {
        ensureStore(ctx, schema);
      }
    },
  },
  {
    version: 5,
    description:
      'Remove license store, add toppings and add-ons stores for order customisation.',
    run: (ctx) => {
      for (const name of RETIRED_STORES) {
        if (ctx.db.objectStoreNames.contains(name)) {
          ctx.db.deleteObjectStore(name);
        }
      }
      for (const schema of STORE_SCHEMAS) {
        ensureStore(ctx, schema);
      }
    },
  },
  {
    version: 6,
    description:
      'Customers store plus the by_customerId index on orders for per-customer history.',
    run: (ctx) => {
      // ensureStore creates the customers store when missing and adds the
      // by_customerId index to an existing orders store — both no-ops on a
      // fresh install where the schema already includes them.
      for (const schema of STORE_SCHEMAS) {
        ensureStore(ctx, schema);
      }
    },
  },
];

/** Apply every migration newer than the database's current version. */
export function runMigrations(ctx: MigrationContext): void {
  const pending = MIGRATIONS.filter(
    (m) => m.version > ctx.oldVersion && m.version <= ctx.newVersion,
  ).sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    migration.run(ctx);
  }
}
