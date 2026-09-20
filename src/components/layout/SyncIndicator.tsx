import { useSyncStatus } from '@/hooks/useSyncStatus';
import { syncEngine } from '@/services/sync/syncEngine';
import styles from './SyncIndicator.module.css';

/**
 * Sync status indicator.
 *
 * Shows Offline / Syncing / Synced / Sync error. Stays out of the way when
 * there is nothing to report: with no backend configured it renders nothing,
 * so a purely local install has no dead chrome.
 */
export function SyncIndicator() {
  const status = useSyncStatus();

  // No backend configured: nothing meaningful to show.
  if (!status.configured) return null;

  const label =
    status.state === 'offline'
      ? 'Offline'
      : status.state === 'syncing'
        ? 'Syncing'
        : status.state === 'error'
          ? 'Sync error'
          : 'Synced';

  const tone =
    status.state === 'synced'
      ? styles.ok
      : status.state === 'error'
        ? styles.bad
        : status.state === 'syncing'
          ? styles.busy
          : styles.idle;

  const detail =
    status.pending > 0
      ? `${status.pending} waiting`
      : status.failed > 0
        ? `${status.failed} failed`
        : null;

  return (
    <div className={styles.wrapper}>
      <span
        className={`${styles.badge} ${tone}`}
        role="status"
        aria-live="polite"
        data-testid="sync-status"
        data-state={status.state}
      >
        <span className={styles.dot} aria-hidden="true" />
        {label}
        {detail ? <span className={styles.detail}>{detail}</span> : null}
      </span>

      {status.state === 'error' ? (
        <button
          type="button"
          className={styles.retry}
          onClick={() => void syncEngine.retryFailed()}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
