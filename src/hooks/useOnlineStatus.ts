import { useEffect, useState } from 'react';

/**
 * Tracks connectivity so offline-first features can react to it.
 *
 * `navigator.onLine` alone is not trustworthy: after a page load that was
 * served entirely from the service worker cache, browsers can report `true`
 * even with no connection, which would hide the offline indicator from a
 * cashier who really is offline. A cheap same-origin probe confirms the
 * reported state.
 *
 * The probe requests a tiny static file that the service worker deliberately
 * does not precache, so a cached response cannot mask a dead connection.
 */

/** Probed at most this often, to avoid pointless traffic. */
const PROBE_INTERVAL_MS = 20_000;

async function probeConnection(): Promise<boolean> {
  if (typeof fetch === 'undefined') return true;

  try {
    const base = import.meta.env.BASE_URL || '/';
    const url = new URL('robots.txt', new URL(base, window.location.href));
    // Cache-bust so neither the HTTP cache nor the worker can answer.
    url.searchParams.set('_probe', String(Date.now()));

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url.href, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });

    window.clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    const verify = async () => {
      // A browser reporting offline is always believed; it is only the
      // optimistic `true` that needs confirming.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (active) setOnline(false);
        return;
      }
      const reachable = await probeConnection();
      if (active) setOnline(reachable);
    };

    const goOnline = () => void verify();
    const goOffline = () => {
      if (active) setOnline(false);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Confirm the initial state, which is where the stale `true` shows up.
    void verify();
    timer = window.setInterval(() => void verify(), PROBE_INTERVAL_MS);

    return () => {
      active = false;
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, []);

  return online;
}
