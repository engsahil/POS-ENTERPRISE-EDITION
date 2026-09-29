/**
 * Customer list state, mirroring the other collection hooks: one shared
 * listener set so any write (POS checkout, Customers screen) refreshes every
 * mounted consumer at once.
 */

import { useCallback, useEffect, useState } from 'react';
import { customerService } from '@/services/customerService';
import type { CustomerRecord } from '@/types/domain';

type Listener = () => void;

const listeners = new Set<Listener>();

/** Tell every mounted consumer that customer records changed. */
export function notifyCustomersChanged(): void {
  for (const listener of listeners) listener();
}

export interface UseCustomersResult {
  customers: CustomerRecord[];
  loading: boolean;
  reload: () => Promise<void>;
}

export function useCustomers(): UseCustomersResult {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setCustomers(await customerService.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = () => {
      if (!active) return;
      void load();
    };
    void load();
    listeners.add(run);
    return () => {
      active = false;
      listeners.delete(run);
    };
  }, [load]);

  return { customers, loading, reload: load };
}
