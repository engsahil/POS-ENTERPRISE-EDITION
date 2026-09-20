import { useCallback, useEffect, useState } from 'react';
import { toppingService } from '@/services/toppingService';
import type { ToppingRecord } from '@/types/domain';

type Listener = () => void;
const listeners = new Set<Listener>();
export function notifyToppingsChanged(): void {
  for (const l of listeners) l();
}

export function useToppings(activeOnly = false) {
  const [items, setItems] = useState<ToppingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = activeOnly ? await toppingService.listActive() : await toppingService.list();
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    let active = true;
    const run = () => {
      if (!active) return;
      void load();
    };
    run();
    listeners.add(run);
    return () => {
      active = false;
      listeners.delete(run);
    };
  }, [load]);

  return { items, loading, reload: load };
}
