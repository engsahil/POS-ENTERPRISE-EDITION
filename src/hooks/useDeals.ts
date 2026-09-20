/**
 * Shared deals state.
 *
 * Mirrors useMenu and useInventory: a publish/subscribe store over the
 * database so publishing a deal reaches the POS immediately.
 */

import { useCallback, useEffect, useState } from 'react';
import { dealService, type DealView } from '@/services/dealService';

type Listener = () => void;

const listeners = new Set<Listener>();

/** Tell every mounted consumer that deals changed. */
export function notifyDealsChanged(): void {
  for (const listener of listeners) listener();
}

export interface UseDealsResult {
  deals: DealView[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Pass `publishedOnly` for the POS, which must only sell live deals. */
export function useDeals(publishedOnly = false): UseDealsResult {
  const [deals, setDeals] = useState<DealView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDeals(
        publishedOnly
          ? await dealService.listPublished()
          : await dealService.list(),
      );
      setError(null);
    } catch {
      setError('Could not load deals.');
    } finally {
      setLoading(false);
    }
  }, [publishedOnly]);

  useEffect(() => {
    let active = true;

    const run = () => {
      void (async () => {
        if (!active) return;
        await load();
      })();
    };

    run();
    listeners.add(run);
    return () => {
      active = false;
      listeners.delete(run);
    };
  }, [load]);

  return { deals, loading, error, reload: load };
}
