/**
 * Offline-first service worker.
 *
 * Generated at build time by scripts/build-sw.mjs, which injects the full
 * list of emitted assets. Everything the application needs is precached on
 * install, so every screen works offline after the first visit - including
 * routes the operator has never opened.
 *
 * Strategy:
 *   navigations -> cached shell first (instant, works offline), refreshed in
 *                  the background so updates are picked up
 *   assets      -> cache first; they are content-hashed so they never go stale
 *   other GETs  -> network, falling back to cache
 *
 * Business data is NOT cached here. Orders, menu, inventory, deals, sales,
 * settings and licence state all live in IndexedDB, which is durable and
 * needs no network.
 */

const REVISION = __BUILD_REVISION__;
const CACHE = `pos-v${REVISION}`;

/** Every file emitted by the build, relative to the worker's scope. */
const PRECACHE = __PRECACHE_MANIFEST__;

/** The worker's directory, so a sub-path deployment resolves correctly. */
const SCOPE_URL = new URL('./', self.location.href);
const SHELL_URL = new URL('index.html', SCOPE_URL).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);

      /*
       * Add files individually rather than with cache.addAll: one missing
       * file would otherwise abort the whole install and leave the app with
       * no offline support at all.
       */
      await Promise.all(
        PRECACHE.map(async (path) => {
          const url = new URL(path, SCOPE_URL).href;
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response.ok) await cache.put(url, response);
          } catch {
            /* a single failure must not break the install */
          }
        }),
      );

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/** Serve the app shell for any in-scope navigation (SPA deep links). */
async function handleNavigation(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(SHELL_URL);

  if (cached) {
    // Refresh in the background; never block the render on the network.
    void fetch(request)
      .then((response) => {
        if (response.ok) cache.put(SHELL_URL, response.clone());
      })
      .catch(() => {
        /* offline: the cached shell is already correct */
      });
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(SHELL_URL, response.clone());
    return response;
  } catch {
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
        '<p style="font-family:system-ui;padding:2rem">This application has ' +
        'not been cached yet. Connect once to finish installing it.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      // Ignore the query string so a cache-busted asset still matches.
      const cached =
        (await cache.match(request)) ??
        (await cache.match(request, { ignoreSearch: true }));
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        // Offline and uncached: fail clearly rather than hanging.
        return new Response('', { status: 504, statusText: 'Offline' });
      }
    })(),
  );
});
