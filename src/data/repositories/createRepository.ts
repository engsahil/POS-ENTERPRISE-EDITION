/**
 * Generic repository factory.
 *
 * Gives every domain a typed CRUD surface over IndexedDB without duplicating
 * plumbing. Stable IDs, createdAt/updatedAt timestamps, soft deletes and
 * revision counters are applied centrally so persistence and a future sync
 * engine behave identically across domains.
 */

import { db } from '@/data/db/indexedDb';
import type { StoreName } from '@/config/storage.config';
import type { BaseEntity, ID } from '@/types/common';
import { createId } from '@/utils/id';
import { nowISO } from '@/utils/date';
import { trackChange } from '@/data/repositories/changeTracker';

/**
 * Caller-supplied fields for a new record.
 *
 * The repository manages createdAt/updatedAt/deletedAt/rev, and generates
 * `id` when it is omitted — so `id` is optional here rather than required.
 */
export type EntityInput<T extends BaseEntity> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'rev'
> & { id?: string };

export interface ListOptions {
  includeDeleted?: boolean;
}

export interface Repository<T extends BaseEntity> {
  readonly store: StoreName;

  getById(id: ID): Promise<T | undefined>;
  list(options?: ListOptions): Promise<T[]>;
  findByIndex(
    indexName: string,
    value: IDBValidKey | IDBKeyRange,
    options?: ListOptions,
  ): Promise<T[]>;
  findOneByIndex(
    indexName: string,
    value: IDBValidKey | IDBKeyRange,
  ): Promise<T | undefined>;

  create(input: EntityInput<T>): Promise<T>;
  createMany(inputs: EntityInput<T>[]): Promise<T[]>;
  update(id: ID, patch: Partial<EntityInput<T>>): Promise<T>;
  upsert(entity: T): Promise<T>;

  /** Soft delete by default so the change can be synced, not lost. */
  remove(id: ID, options?: { hard?: boolean }): Promise<void>;
  /** Permanently remove every record. Used by the reset tool. */
  clear(): Promise<void>;

  count(): Promise<number>;
}

/** Build a complete entity from caller input, stamping managed fields. */
export function buildEntity<T extends BaseEntity>(input: EntityInput<T>): T {
  const timestamp = nowISO();
  return {
    ...(input as object),
    id: input.id ?? createId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    rev: 1,
  } as T;
}

export function createRepository<T extends BaseEntity>(
  store: StoreName,
): Repository<T> {
  const notDeleted = (records: T[], includeDeleted?: boolean) =>
    includeDeleted ? records : records.filter((r) => !r.deletedAt);

  return {
    store,

    getById(id) {
      return db.get<T>(store, id);
    },

    async list(options) {
      const all = await db.getAll<T>(store);
      return notDeleted(all, options?.includeDeleted);
    },

    async findByIndex(indexName, value, options) {
      const found = await db.getAllByIndex<T>(store, indexName, value);
      return notDeleted(found, options?.includeDeleted);
    },

    findOneByIndex(indexName, value) {
      return db.getOneByIndex<T>(store, indexName, value);
    },

    async create(input) {
      const entity = buildEntity<T>(input);
      await db.put<T>(store, entity);
      // Queue for upload centrally, so no call site can forget to.
      await trackChange(store, entity.id, 'create', entity);
      return entity;
    },

    async createMany(inputs) {
      const entities = inputs.map((input) => buildEntity<T>(input));
      await db.putMany<T>(store, entities);
      for (const entity of entities) {
        await trackChange(store, entity.id, 'create', entity);
      }
      return entities;
    },

    async update(id, patch) {
      const existing = await db.get<T>(store, id);
      if (!existing) throw new Error(`[${store}] record not found: ${id}`);

      const updated: T = {
        ...existing,
        ...(patch as object),
        // Identity and creation time are immutable.
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: nowISO(),
        rev: (existing.rev ?? 1) + 1,
      } as T;

      await db.put<T>(store, updated);
      await trackChange(store, updated.id, 'update', updated);
      return updated;
    },

    async upsert(entity) {
      const existing = await db.get<T>(store, entity.id);
      const next: T = {
        ...entity,
        createdAt: existing?.createdAt ?? entity.createdAt ?? nowISO(),
        updatedAt: nowISO(),
        rev: (existing?.rev ?? entity.rev ?? 0) + 1,
      };
      await db.put<T>(store, next);
      await trackChange(store, next.id, 'update', next);
      return next;
    },

    async remove(id, options) {
      if (options?.hard) {
        await db.remove(store, id);
        await trackChange(store, id, 'delete', null);
        return;
      }

      const existing = await db.get<T>(store, id);
      if (!existing) return;

      const timestamp = nowISO();
      const removed = {
        ...existing,
        deletedAt: timestamp,
        updatedAt: timestamp,
        rev: (existing.rev ?? 1) + 1,
      };
      await db.put<T>(store, removed);
      await trackChange(store, id, 'delete', removed);
    },

    clear() {
      return db.clear(store);
    },

    count() {
      return db.count(store);
    },
  };
}
