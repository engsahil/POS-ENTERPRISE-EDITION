/**
 * Central change tracking for synchronisation.
 *
 * Every repository write funnels through here, so a new feature cannot
 * forget to queue its changes. Keeping it in one place is what makes
 * "no data loss" a property of the architecture rather than of discipline.
 *
 * Design notes:
 *
 *  - Only SYNCABLE_STORES are tracked. The queue itself is excluded (that
 *    would recurse), as are settings and admin credentials, which are
 *    per-terminal and must not be pushed to a shared backend.
 *
 *  - Orders enqueue their own composite payload in orderService (header +
 *    items + sale as one unit), so the individual stores are not tracked
 *    twice. That keeps a sale atomic on the wire.
 *
 *  - Tracking never throws. A queueing problem must not fail the write that
 *    the operator just performed.
 */

import { STORES } from '@/config/storage.config';
import type { SyncOperation } from '@/types/domain';

/** Stores whose changes belong on a shared backend. */
const SYNCABLE_STORES = new Set<string>([
  STORES.menuItems,
  STORES.itemPrices,
  STORES.inventory,
  STORES.deals,
  STORES.restaurant,
]);

/** Set false during bulk local operations such as a data reset. */
let enabled = true;

export function setChangeTracking(value: boolean): void {
  enabled = value;
}

export function isChangeTrackingEnabled(): boolean {
  return enabled;
}

export async function trackChange(
  store: string,
  entityId: string,
  operation: SyncOperation,
  payload: unknown,
): Promise<void> {
  if (!enabled) return;
  if (!SYNCABLE_STORES.has(store)) return;

  try {
    // Imported lazily to avoid a cycle: the queue uses a repository too.
    const { syncQueueService } = await import('@/services/syncQueueService');
    await syncQueueService.enqueue({
      entity: store,
      entityId,
      operation,
      payload,
    });

    // Tell the engine so the indicator shows the new pending count
    // immediately, rather than only after the next drain or poll.
    void notifyQueued();
  } catch {
    /* queueing must never fail the underlying write */
  }
}

/**
 * Refresh sync status after queueing.
 *
 * Kept separate and fire-and-forget: the operator's write has already
 * succeeded and must not wait on, or be failed by, status bookkeeping.
 */
async function notifyQueued(): Promise<void> {
  try {
    const { syncEngine } = await import('@/services/sync/syncEngine');
    await syncEngine.refresh();
  } catch {
    /* status is cosmetic; never let it break a write */
  }
}
