import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { OfflineBanner } from './OfflineBanner';
import { SyncIndicator } from './SyncIndicator';
import { Spinner } from '@/components/ui';
import styles from './AppLayout.module.css';

/**
 * Application shell.
 *
 * Navigation is the only persistent chrome — there is no app header and no
 * footer. Each screen supplies its own heading via PageHeader.
 */
export function AppLayout() {
  return (
    <div className={styles.shell}>
      <Sidebar />

      <div className={styles.body}>
        <OfflineBanner />
        {/* Renders nothing unless a sync backend is configured. */}
        <div className={styles.syncSlot} data-print-hide>
          <SyncIndicator />
        </div>
        <main className={styles.main} id="main-content">
          <Suspense fallback={<Spinner fullscreen label="Loading section" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <TabBar />
    </div>
  );
}
