import { useCallback, useEffect, useState } from 'react';
import { addOnService } from '@/services/addOnService';
import type { AddOnRecord } from '@/types/domain';

type Listener = () => void;
const listeners = new Set<Listener>();
export function notifyAddOnsChanged(): void {
  for (const l of listeners) l();
}

export function useAddOns(activeOnly = false) {
  const [items, setItems] = useState<AddOnRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = activeOnly ? await addOnService.listActive() : await addOnService.list();
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
