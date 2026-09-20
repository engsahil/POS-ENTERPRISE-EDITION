/**
 * Shared menu state.
 *
 * A tiny publish/subscribe store sits over the database so that saving an
 * item in Menu management immediately refreshes every mounted consumer —
 * including the POS — without a page reload or a global state library.
 */

import { useCallback, useEffect, useState } from 'react';
import { inventoryService } from '@/services/inventoryService';
import { menuService, type MenuItemWithPrices } from '@/services/menuService';

type Listener = () => void;

const listeners = new Set<Listener>();

/** Tell every mounted consumer that the menu changed. */
export function notifyMenuChanged(): void {
  for (const listener of listeners) listener();
}

export interface UseMenuResult {
  items: MenuItemWithPrices[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export interface UseMenuOptions {
  /** Exclude disabled items. */
  activeOnly?: boolean;
  /**
   * Exclude items whose linked stock line is out of stock or unavailable.
   * The POS uses this so staff cannot sell what is not in stock.
   */
  inStockOnly?: boolean;
}

/**
 * Load menu items, keeping them in sync with database changes.
 * The POS passes both flags so disabled and out-of-stock items are withheld.
 */
export function useMenu(options: boolean | UseMenuOptions = {}): UseMenuResult {
  // A bare boolean keeps the original `useMenu(true)` call signature working.
  const { activeOnly = false, inStockOnly = false } =
    typeof options === 'boolean' ? { activeOnly: options } : options;

  const [items, setItems] = useState<MenuItemWithPrices[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      let next = activeOnly
        ? await menuService.listActive()
        : await menuService.list();

      if (inStockOnly) {
        const blocked = await inventoryService.blockedMenuItemIds();
        next = next.filter((entry) => !blocked.has(entry.item.id));
      }

      setItems(next);
      setError(null);
    } catch {
      setError('Could not load the menu.');
    } finally {
      setLoading(false);
    }
  }, [activeOnly, inStockOnly]);

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
