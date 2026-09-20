/**
 * Shared inventory state.
 *
 * Mirrors useMenu: a tiny publish/subscribe store over the database so a
 * stock change immediately refreshes every mounted consumer, including the
 * POS, without a reload or a state library.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  inventoryService,
  type InventoryItemView,
} from '@/services/inventoryService';
import { notifyMenuChanged } from './useMenu';

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Tell every mounted consumer that inventory changed.
 *
 * Menu subscribers are notified too, because the POS filters menu items by
 * stock and must re-evaluate when a stock line changes.
 */
export function notifyInventoryChanged(): void {
  for (const listener of listeners) listener();
  notifyMenuChanged();
}

export interface UseInventoryResult {
  items: InventoryItemView[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useInventory(): UseInventoryResult {
  const [items, setItems] = useState<InventoryItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await inventoryService.list());
      setError(null);
    } catch {
      setError('Could not load inventory.');
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

  return { items, loading, error, reload: load };
}
