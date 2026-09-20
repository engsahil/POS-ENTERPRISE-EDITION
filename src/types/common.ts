/** Shared primitive/domain-agnostic types. */

export type ID = string;

/** ISO-8601 timestamp string. */
export type ISODateString = string;

/** Monetary amount stored as an integer number of paisa (1 Rs. = 100 paisa). */
export type Paisa = number;

/** Base fields every persisted record carries — enables sync + audit later. */
export interface BaseEntity {
  id: ID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  /** Soft delete marker so deletions can be synced instead of lost. */
  deletedAt?: ISODateString | null;
  /** Optimistic-concurrency / conflict-resolution counter. */
  rev?: number;
}

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface Result<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type Nullable<T> = T | null;
