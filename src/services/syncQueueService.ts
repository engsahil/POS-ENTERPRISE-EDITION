/**
 * Sync queue.
 *
 * Local mutations are the source of truth. Changes are enqueued here and
 * drained in order once connectivity returns. The queue is durable, so a
 * change survives a crash, a restart, or weeks offline.
 */

import { syncQueueRepository } from '@/data/repositories';
import { backoffFor, SYNC_CONFIG } from '@/config/sync.config';
import { createId } from '@/utils/id';
import type {
  SyncOperation,
  SyncQueueRecord,
  SyncQueueStatus,
} from '@/types/domain';
import type { ID } from '@/types/common';
import { nowISO } from '@/utils/date';

const MAX_ATTEMPTS = SYNC_CONFIG.maxAttempts;

export const syncQueueService = {
  /**
   * Record a local change for later upload.
   *
   * Each entry carries an idempotency key generated once, here. Every retry
   * reuses it, so a response lost after the server committed can never
   * produce a duplicate record.
   */
  async enqueue(input: {
    entity: string;
    entityId: ID;
    operation: SyncOperation;
    payload?: unknown;
  }): Promise<SyncQueueRecord> {
    return syncQueueRepository.create({
      entity: input.entity,
      entityId: input.entityId,
      operation: input.operation,
      payload: input.payload ?? null,
      status: 'pending',
      attempts: 0,
      lastAttemptAt: null,
      lastError: null,
      idempotencyKey: createId(),
      nextAttemptAt: null,
    });
  },

  /** Queued items awaiting upload, oldest first. */
  async pending(): Promise<SyncQueueRecord[]> {
    const records = await syncQueueRepository.findByIndex('by_status', 'pending');
    return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  /**
   * Pending items whose backoff has elapsed, oldest first.
   * Ordering matters: changes must reach the server in the order they were
   * made locally.
   */
  async due(limit = SYNC_CONFIG.batchSize): Promise<SyncQueueRecord[]> {
    const now = Date.now();
    const records = await this.pending();
    return records
      .filter(
        (r) => !r.nextAttemptAt || new Date(r.nextAttemptAt).getTime() <= now,
      )
      .slice(0, limit);
  },

  /** Mark a batch as in flight so a second drain cannot pick them up. */
  async markSyncing(ids: ID[]): Promise<void> {
    for (const id of ids) {
      await syncQueueRepository.update(id, { status: 'syncing' });
    }
  },

  /** Return in-flight items to pending, e.g. after an interrupted drain. */
  async releaseSyncing(): Promise<number> {
    const stuck = await syncQueueRepository.findByIndex('by_status', 'syncing');
    for (const record of stuck) {
      await syncQueueRepository.update(record.id, { status: 'pending' });
    }
    return stuck.length;
  },

  /** Send failed items back to the queue for another try. */
  async retryFailed(): Promise<number> {
    const failed = await syncQueueRepository.findByIndex('by_status', 'failed');
    for (const record of failed) {
      await syncQueueRepository.update(record.id, {
        status: 'pending',
        attempts: 0,
        nextAttemptAt: null,
        lastError: null,
      });
    }
    return failed.length;
  },

  async all(): Promise<SyncQueueRecord[]> {
    return syncQueueRepository.list();
  },

  async countByStatus(status: SyncQueueStatus): Promise<number> {
    const records = await syncQueueRepository.findByIndex('by_status', status);
    return records.length;
  },

  async markSynced(id: ID): Promise<void> {
    await syncQueueRepository.update(id, {
      status: 'synced',
      lastAttemptAt: nowISO(),
      lastError: null,
    });
  },

  /**
   * Record a failed attempt.
   *
   * The item returns to `pending` with an exponential backoff until it has
   * been tried MAX_ATTEMPTS times, after which it is parked as `failed`.
   * Nothing is ever discarded, so a change cannot be silently lost.
   */
  async markFailed(id: ID, error: string): Promise<void> {
    const record = await syncQueueRepository.getById(id);
    if (!record) return;

    const attempts = record.attempts + 1;
    const exhausted = attempts >= MAX_ATTEMPTS;

    await syncQueueRepository.update(id, {
      attempts,
      status: exhausted ? 'failed' : 'pending',
      lastAttemptAt: nowISO(),
      lastError: error,
      nextAttemptAt: exhausted
        ? null
        : new Date(Date.now() + backoffFor(attempts)).toISOString(),
    });
  },

  /** Drop successfully synced entries so the queue does not grow forever. */
  async purgeSynced(): Promise<number> {
    const synced = await syncQueueRepository.findByIndex('by_status', 'synced');
    for (const record of synced) {
      await syncQueueRepository.remove(record.id, { hard: true });
    }
    return synced.length;
  },
};
