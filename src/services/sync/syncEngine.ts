/**
 * Sync engine.
 *
 *   offline change -> local database -> sync queue
 *                  -> internet available -> synchronise
 *                  -> confirm success -> mark synced
 *
 * Guarantees:
 *
 *   No duplicates   Every queue item carries an idempotency key generated
 *                   once at enqueue time and reused on every retry, so a
 *                   response lost after the server committed cannot create a
 *                   second record. The server reports `duplicate`, which the
 *                   engine treats as success.
 *
 *   No data loss    Items are only removed after the server confirms them.
 *                   A failure returns the item to the queue with backoff; on
 *                   exhaustion it is parked as `failed`, never deleted.
 *
 *   Safe retry      Exponential backoff, a cap on attempts, and a single-
 *                   flight lock so two drains cannot run at once.
 *
 *   Safe conflicts  Orders and sales are immutable history: the server never
 *                   overwrites them. Editable records resolve last-write-wins
 *                   by `updatedAt`, and a server-won conflict is applied
 *                   locally so both sides converge.
 *
 * Billing is never blocked: the engine runs in the background and every path
 * out of it is non-throwing.
 */

import { SYNC_CONFIG } from '@/config/sync.config';
import { repositories } from '@/data/repositories';
import { setChangeTracking } from '@/data/repositories/changeTracker';
import { STORES } from '@/config/storage.config';
import { syncQueueService } from '../syncQueueService';
import {
  createSyncClient,
  type SyncClient,
  type SyncItem,
} from './syncClient';
import type { SyncQueueRecord } from '@/types/domain';

export type SyncState = 'offline' | 'syncing' | 'synced' | 'error' | 'disabled';

export interface SyncStatus {
  state: SyncState;
  /** Items waiting to upload. */
  pending: number;
  /** Items parked after exhausting their retries. */
  failed: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  /** Whether a backend is configured at all. */
  configured: boolean;
}

/** Entities whose history must never be overwritten by the server. */
const IMMUTABLE_ENTITIES = new Set<string>([
  STORES.orders,
  STORES.orderItems,
  STORES.sales,
]);

type Listener = (status: SyncStatus) => void;

let client: SyncClient = createSyncClient();
let draining = false;
let timer: number | undefined;

const listeners = new Set<Listener>();

let status: SyncStatus = {
  state: client.configured ? 'synced' : 'disabled',
  pending: 0,
  failed: 0,
  lastSyncedAt: null,
  lastError: null,
  configured: client.configured,
};

function publish(next: Partial<SyncStatus>): void {
  status = { ...status, ...next };
  for (const listener of listeners) listener(status);
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

async function refreshCounts(): Promise<{ pending: number; failed: number }> {
  const [pending, failed] = await Promise.all([
    syncQueueService.countByStatus('pending'),
    syncQueueService.countByStatus('failed'),
  ]);
  return { pending, failed };
}

/** Turn a queue record into the wire format. */
function toItem(record: SyncQueueRecord): SyncItem {
  return {
    id: record.id,
    idempotencyKey: record.idempotencyKey ?? record.id,
    entity: record.entity,
    entityId: record.entityId,
    operation: record.operation,
    payload: record.payload,
    rev: record.rev ?? 1,
    updatedAt: record.updatedAt,
  };
}

/**
 * Apply an authoritative server record locally after a conflict.
 * Only ever called for mutable entities.
 */
async function applyServerRecord(
  entity: string,
  serverRecord: Record<string, unknown>,
): Promise<void> {
  const repo = repositories[entity as keyof typeof repositories];
  if (!repo) return;

  const id = serverRecord.id;
  if (typeof id !== 'string') return;

  /*
   * Change tracking is suspended while applying the server's record.
   * Without this the write would enqueue a new change, which the drain would
   * immediately pick up, push, and receive another conflict for - an endless
   * loop that never lets sync finish.
   */
  setChangeTracking(false);
  try {
    // upsert keeps createdAt semantics intact and bumps rev locally.
    await (repo as { upsert: (r: unknown) => Promise<unknown> }).upsert(
      serverRecord,
    );
  } catch {
    /* a conflict we cannot apply must not break the drain */
  } finally {
    setChangeTracking(true);
  }
}

export const syncEngine = {
  /** Subscribe to status changes. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    listener(status);
    return () => listeners.delete(listener);
  },

  getStatus(): SyncStatus {
    return status;
  },

  /** Swap the transport. Used by tests and when configuration changes. */
  setClient(next: SyncClient): void {
    client = next;
    publish({
      configured: next.configured,
      state: next.configured ? (isOnline() ? 'synced' : 'offline') : 'disabled',
    });
  },

  /** Recompute pending/failed counts without contacting the server. */
  async refresh(): Promise<SyncStatus> {
    const counts = await refreshCounts();

    // Offline takes precedence over everything except an in-flight drain:
    // reporting "synced" while disconnected with queued work would be a lie.
    const state: SyncState = !client.configured
      ? 'disabled'
      : status.state === 'syncing'
        ? 'syncing'
        : !isOnline()
          ? 'offline'
          : counts.failed > 0
            ? 'error'
            : 'synced';

    publish({ ...counts, state });
    return status;
  },

  /**
   * Drain the queue.
   *
   * Safe to call at any time: it returns immediately if sync is disabled,
   * offline, or already running. Never throws.
   */
  async sync(): Promise<SyncStatus> {
    if (!client.configured) {
      publish({ state: 'disabled' });
      return status;
    }

    if (!isOnline()) {
      const counts = await refreshCounts();
      publish({ ...counts, state: 'offline' });
      return status;
    }

    // Single-flight: a second call while draining is a no-op.
    if (draining) return status;
    draining = true;

    try {
      // Recover anything left in flight by an interrupted previous run.
      await syncQueueService.releaseSyncing();

      let batch = await syncQueueService.due(SYNC_CONFIG.batchSize);
      if (batch.length === 0) {
        const counts = await refreshCounts();
        publish({
          ...counts,
          state: counts.failed > 0 ? 'error' : 'synced',
          lastError: counts.failed > 0 ? status.lastError : null,
        });
        return status;
      }

      publish({ state: 'syncing' });

      /*
       * Hard bound on the number of batches per drain. Sync must always
       * terminate, even if a server behaved unexpectedly and new work kept
       * appearing; the remainder is simply picked up on the next run.
       */
      const maxBatches = 50;
      let processed = 0;

      while (batch.length > 0 && processed < maxBatches) {
        processed += 1;
        await syncQueueService.markSyncing(batch.map((r) => r.id));

        const result = await client.push(batch.map(toItem));

        if (!result.ok) {
          // Whole-request failure: every item in the batch is retried.
          for (const record of batch) {
            await syncQueueService.markFailed(
              record.id,
              result.error ?? 'Sync failed',
            );
          }
          const counts = await refreshCounts();
          publish({
            ...counts,
            state: 'error',
            lastError: result.error ?? 'Sync failed',
          });
          return status;
        }

        const byId = new Map(result.results.map((r) => [r.id, r]));

        for (const record of batch) {
          const outcome = byId.get(record.id);

          if (!outcome) {
            // The server said nothing about this item; retry it.
            await syncQueueService.markFailed(record.id, 'No result returned');
            continue;
          }

          if (outcome.status === 'accepted' || outcome.status === 'duplicate') {
            // `duplicate` means the server already had it - the desired end
            // state - so it counts as success.
            await syncQueueService.markSynced(record.id);
            continue;
          }

          if (outcome.status === 'conflict') {
            if (
              !IMMUTABLE_ENTITIES.has(record.entity) &&
              outcome.serverRecord
            ) {
              await applyServerRecord(record.entity, outcome.serverRecord);
            }
            // Either way the local change is resolved; do not retry forever.
            await syncQueueService.markSynced(record.id);
            continue;
          }

          // rejected: the server will never accept it. Park it for review
          // rather than retrying indefinitely.
          await syncQueueService.markFailed(
            record.id,
            outcome.message ?? 'Rejected by server',
          );
        }

        await syncQueueService.purgeSynced();
        batch = await syncQueueService.due(SYNC_CONFIG.batchSize);
      }

      const counts = await refreshCounts();
      publish({
        ...counts,
        state: counts.failed > 0 ? 'error' : 'synced',
        lastSyncedAt: new Date().toISOString(),
        lastError: counts.failed > 0 ? status.lastError : null,
      });
      return status;
    } catch (error) {
      // A bug in sync must never take the till down.
      const message = error instanceof Error ? error.message : 'Sync failed';
      await syncQueueService.releaseSyncing();
      const counts = await refreshCounts();
      publish({ ...counts, state: 'error', lastError: message });
      return status;
    } finally {
      draining = false;
    }
  },

  /** Re-queue parked items and drain again. */
  async retryFailed(): Promise<SyncStatus> {
    await syncQueueService.retryFailed();
    return this.sync();
  },

  /** Begin background syncing: on reconnect, and on a slow poll. */
  start(): void {
    if (typeof window === 'undefined') return;

    const onOnline = () => void this.sync();
    const onOffline = () => void this.refresh();

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    void this.refresh().then(() => {
      if (client.configured && isOnline()) void this.sync();
    });

    if (timer !== undefined) window.clearInterval(timer);
    timer = window.setInterval(() => {
      if (client.configured && isOnline()) void this.sync();
    }, SYNC_CONFIG.pollIntervalMs);
  },

  stop(): void {
    if (timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  },
};
