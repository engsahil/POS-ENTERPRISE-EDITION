import { OfflineIcon } from '@/components/ui/Icons';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import styles from './OfflineBanner.module.css';

/** Renders nothing while online — no permanent header chrome. */
export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <OfflineIcon className={styles.icon} />
      <span>Offline — changes are saved on this device.</span>
    </div>
  );
}
