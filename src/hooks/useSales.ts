/**
 * Sales analytics state.
 *
 * Recomputed whenever an order completes, so the figures reflect the
 * database rather than a stale snapshot.
 */

import { useCallback, useEffect, useState } from 'react';
import { salesService, type SalesOverview } from '@/services/salesService';

type Listener = () => void;

const listeners = new Set<Listener>();

/** Tell every mounted consumer that sales changed. */
export function notifySalesChanged(): void {
  for (const listener of listeners) listener();
}

export interface UseSalesResult {
  overview: SalesOverview | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useSales(): UseSalesResult {
  const [overview, setOverview] = useState<SalesOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOverview(await salesService.overview());
      setError(null);
    } catch {
      setError('Could not load sales.');
    } finally {
      setLoading(false);
    }
  }, []);

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

  return { overview, loading, error, reload: load };
}
