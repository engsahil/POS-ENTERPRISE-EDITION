/**
 * Service worker registration.
 *
 * Registered only in production builds so the dev server keeps hot reload.
 * The worker precaches the entire build (see src/pwa/sw.template.js), which
 * is what makes every screen work offline after the first visit.
 */

export function registerServiceWorker(): void {
  if (import.meta.env.DEV) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    /*
     * Resolve against the deployed base rather than the domain root, so the
     * worker is found when the app is hosted under a sub-path. BASE_URL is
     * './' for a relative build, which resolves correctly from the page.
     */
    const base = import.meta.env.BASE_URL || '/';
    const swUrl = new URL('sw.js', new URL(base, window.location.href)).href;
    const scope = new URL(base, window.location.href).href;

    void navigator.serviceWorker
      .register(swUrl, { scope })
      .then((registration) => {
        // Pick up a new build without requiring a manual hard reload.
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              installing.postMessage('SKIP_WAITING');
            }
          });
        });
      })
      .catch(() => {
        /* registration failures must never break the app */
      });
  });
}

export async function unregisterServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((r) => r.unregister()));
}
