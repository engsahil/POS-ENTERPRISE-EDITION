/**
 * Live sync status for the UI.
 *
 * Subscribes to the engine rather than polling, so the indicator reflects the
 * real state without the UI driving any work.
 */

import { useEffect, useState } from 'react';
import { syncEngine, type SyncStatus } from '@/services/sync/syncEngine';

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(() => syncEngine.getStatus());

  useEffect(() => syncEngine.subscribe(setStatus), []);

  return status;
}
