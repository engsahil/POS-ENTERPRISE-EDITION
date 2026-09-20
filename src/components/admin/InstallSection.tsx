import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { useInstallState } from '@/hooks/useInstallState';
import { installService } from '@/pwa/installService';
import styles from './PanelSection.module.css';

/**
 * Install this terminal as an application.
 *
 * The action offered depends on what the browser actually supports. No
 * install button is shown to a browser that cannot install, and iOS is given
 * the real manual steps rather than a button that would do nothing.
 */
export function InstallSection() {
  const install = useInstallState();
  const [outcome, setOutcome] = useState<string | null>(null);
  const [swReady, setSwReady] = useState<boolean | null>(null);
  const [cached, setCached] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        if (active) setSwReady(false);
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      if (active) setSwReady(Boolean(registration?.active));

      try {
        const keys = await caches.keys();
        const cache = keys[0] ? await caches.open(keys[0]) : null;
        const entries = cache ? (await cache.keys()).length : 0;
        if (active) setCached(entries);
      } catch {
        if (active) setCached(null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleInstall() {
    const result = await installService.promptInstall();
    setOutcome(
      result === 'accepted'
        ? 'Installed. Launch it from your applications or home screen.'
        : result === 'dismissed'
          ? 'Installation was dismissed. You can install later from here.'
          : 'The browser did not offer an install prompt.',
    );
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>Install</h3>
          <span
            className={`${styles.badge} ${
              install.availability === 'installed'
                ? styles.badgeOk
                : install.availability === 'promptable'
                  ? styles.badgeWarn
                  : styles.badgeNeutral
            }`}
            data-testid="install-status"
          >
            {install.availability === 'installed'
              ? 'INSTALLED'
              : install.availability === 'promptable'
                ? 'READY TO INSTALL'
                : install.availability === 'manual-ios'
                  ? 'MANUAL INSTALL'
                  : install.availability === 'pending'
                    ? 'CHECKING'
                    : 'NOT AVAILABLE'}
          </span>
        </div>

        {install.availability === 'installed' ? (
          <p className={styles.hint}>
            This terminal is running as an installed application
            {install.standalone ? ' in its own window' : ''}. It launches from
            your applications list and works without a browser tab.
          </p>
        ) : install.availability === 'promptable' ? (
          <>
            <p className={styles.hint}>
              Install the POS so it launches in its own window, starts from
              your applications list, and keeps working offline.
            </p>
            <div className={styles.actions}>
              <Button onClick={() => void handleInstall()}>
                Install application
              </Button>
            </div>
          </>
        ) : install.availability === 'manual-ios' ? (
          <>
            <p className={styles.hint}>
              Safari does not offer a one-tap install. To add the POS to your
              home screen:
            </p>
            <ol className={styles.steps}>
              <li>Tap the Share button in the Safari toolbar.</li>
              <li>Scroll down and choose &ldquo;Add to Home Screen&rdquo;.</li>
              <li>Confirm the name and tap Add.</li>
            </ol>
          </>
        ) : install.availability === 'pending' ? (
          <p className={styles.hint}>Checking whether this browser can install the application…</p>
        ) : (
          <p className={styles.hint}>
            This browser does not support installing web applications. The POS
            still works normally in the browser, including offline. Chrome or
            Edge on desktop and Android support installation.
          </p>
        )}

        {outcome ? (
          <p className={styles.status} role="status">
            {outcome}
          </p>
        ) : null}
      </section>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Offline readiness</h3>
        <p className={styles.hint}>
          The application caches itself so it opens without a connection.
        </p>
        <dl className={styles.details}>
          <div className={styles.row}>
            <dt className={styles.rowLabel}>Display mode</dt>
            <dd className={styles.rowValue}>
              {install.standalone ? 'Standalone window' : 'Browser tab'}
            </dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.rowLabel}>Service worker</dt>
            <dd className={styles.rowValue}>
              {swReady === null
                ? 'Checking'
                : swReady
                  ? 'Active'
                  : 'Not registered (development build)'}
            </dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.rowLabel}>Files cached</dt>
            <dd className={styles.rowValue}>
              {cached === null ? '--' : cached}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
