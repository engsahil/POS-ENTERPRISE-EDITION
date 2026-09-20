import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/app/App';
import { registerServiceWorker } from '@/pwa/registerServiceWorker';
import { installService } from '@/pwa/installService';
import { databaseService } from '@/services/databaseService';
import '@/styles/global.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element #root was not found in the document.');
}

/*
 * Router basename.
 *
 * Matches the deployed base path so routing works when the app is hosted
 * under a sub-path (e.g. /pos/). A relative base ('./') carries no path
 * information, so the basename is derived from the directory the page was
 * actually served from.
 */
function resolveBasename(): string {
  const base = import.meta.env.BASE_URL || '/';
  if (base !== './' && base !== '.') return base;

  const path = window.location.pathname;
  // Strip a trailing file name, e.g. /pos/index.html -> /pos/
  return path.endsWith('/') ? path : path.slice(0, path.lastIndexOf('/') + 1);
}

/** Remove the pre-render boot screen once React has painted. */
function clearBootScreen(): void {
  const boot = document.getElementById('app-boot');
  if (!boot) return;
  boot.style.transition = 'opacity 180ms ease-out';
  boot.style.opacity = '0';
  window.setTimeout(() => boot.remove(), 200);
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter
      basename={resolveBasename()}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </BrowserRouter>
  </StrictMode>,
);

// Open the local database and request persistent storage before the first
// paint completes. Failures surface through the app's own error handling
// rather than blocking startup.
void databaseService.initialise().then(() => {
  // Background synchronisation. Inert unless VITE_SYNC_API_URL is set, and
  // never on the billing path.
  void import('@/services/sync/syncEngine').then(({ syncEngine }) => {
    syncEngine.start();
  });
});

/*
 * Automated-test bridge.
 *
 * End-to-end tests drive the app through its real UI, but also need to set up
 * fixtures and assert persisted state. Exposing the services avoids reaching
 * into internals via source-path imports, which do not exist in a production
 * bundle. Guarded so it never ships in a normal build.
 */
if (import.meta.env.VITE_EXPOSE_TEST_API === 'true') {
  void (async () => {
    const [
      menu,
      deals,
      inventory,
      restaurant,
      receipt,
      order,
      settings,
      escpos,
      printer,
      printService,
      sales,
      toppings,
      addOns,
      syncEngineMod,
      syncQueueMod,
    ] = await Promise.all([
      import('@/services/menuService'),
      import('@/services/dealService'),
      import('@/services/inventoryService'),
      import('@/services/restaurantService'),
      import('@/services/receiptService'),
      import('@/services/orderService'),
      import('@/services/settingsService'),
      import('@/services/escpos'),
      import('@/services/printerService'),
      import('@/services/printService'),
      import('@/services/salesService'),
      import('@/services/toppingService'),
      import('@/services/addOnService'),
      import('@/services/sync/syncEngine'),
      import('@/services/syncQueueService'),
    ]);

    (window as unknown as { __pos: unknown }).__pos = {
      menuService: menu.menuService,
      dealService: deals.dealService,
      inventoryService: inventory.inventoryService,
      restaurantService: restaurant.restaurantService,
      receiptService: receipt.receiptService,
      orderService: order.orderService,
      settingsService: settings.settingsService,
      SETTING_KEYS: settings.SETTING_KEYS,
      escpos,
      printerService: printer.printerService,
      printService,
      salesService: sales.salesService,
      toppingService: toppings.toppingService,
      addOnService: addOns.addOnService,
      syncEngine: syncEngineMod.syncEngine,
      syncQueueService: syncQueueMod.syncQueueService,
      installService,
    };
  })();
}

registerServiceWorker();

// Watch for the browser's install prompt so Admin can offer installation
// only when it will actually work.
installService.start();

// The shell is mounted; drop the boot placeholder.
clearBootScreen();
