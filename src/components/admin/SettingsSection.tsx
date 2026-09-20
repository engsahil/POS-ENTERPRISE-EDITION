import { useEffect, useState } from 'react';
import { Button, Input } from '@/components/ui';
import { APP_CONFIG, CURRENCY } from '@/config/app.config';
import { VENDOR } from '@/content/legal';
import { SETTING_KEYS, settingsService } from '@/services/settingsService';
import styles from './PanelSection.module.css';

/**
 * Terminal preferences.
 *
 * Deliberately small: only settings that already affect behaviour elsewhere
 * in the app are offered, so nothing here is a dead switch.
 */
export interface SettingsSectionProps {
  /** Opens the About section, where the legal documents live. */
  onOpenAbout?: () => void;
}

export function SettingsSection({ onOpenAbout }: SettingsSectionProps = {}) {
  const [prefix, setPrefix] = useState('');
  const [autoShow, setAutoShow] = useState(true);
  const [lowStock, setLowStock] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [p, a, l] = await Promise.all([
        settingsService.get<string>(SETTING_KEYS.orderNumberPrefix, ''),
        settingsService.get<boolean>(SETTING_KEYS.autoShowReceipt, true),
        settingsService.get<number | null>(SETTING_KEYS.lowStockDefault, null),
      ]);
      if (!active) return;
      setPrefix(p);
      setAutoShow(a);
      setLowStock(l === null ? '' : String(l));
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      await Promise.all([
        settingsService.set(SETTING_KEYS.orderNumberPrefix, prefix.trim()),
        settingsService.set(SETTING_KEYS.autoShowReceipt, autoShow),
        settingsService.set(
          SETTING_KEYS.lowStockDefault,
          lowStock.trim() === '' ? null : Number(lowStock),
        ),
      ]);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return <p className={styles.loading}>Loading settings…</p>;
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>Preferences</h3>
          <span className={styles.status} aria-live="polite">
            {saved ? 'Saved' : ''}
          </span>
        </div>

        <Input
          label="Order number prefix"
          name="orderPrefix"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value.slice(0, 6))}
          hint="Optional. Shown in front of order numbers, e.g. A-0001."
          autoComplete="off"
          fullWidth
        />

        <Input
          label="Default low stock level"
          name="lowStockDefault"
          value={lowStock}
          onChange={(e) => {
            const next = e.target.value;
            if (next !== '' && !/^\d{0,5}$/.test(next)) return;
            setLowStock(next);
          }}
          hint="Optional. Pre-fills the low stock alert when adding inventory."
          inputMode="numeric"
          autoComplete="off"
          fullWidth
        />

        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            name="autoShowReceipt"
            className={styles.checkbox}
            checked={autoShow}
            onChange={(e) => setAutoShow(e.target.checked)}
          />
          <span>
            <span className={styles.toggleLabel}>
              Show the receipt after completing an order
            </span>
            <span className={styles.toggleHint}>
              Turn off to return straight to a new order.
            </span>
          </span>
        </label>

        <div className={styles.actions}>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving' : 'Save settings'}
          </Button>
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Fixed configuration</h3>
        <p className={styles.hint}>
          Set at build time and not editable from the terminal.
        </p>
        <dl className={styles.details}>
          <div className={styles.row}>
            <dt className={styles.rowLabel}>Currency</dt>
            <dd className={styles.rowValue}>
              {CURRENCY.symbol} ({CURRENCY.code})
            </dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.rowLabel}>Locale</dt>
            <dd className={styles.rowValue}>{APP_CONFIG.locale}</dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.rowLabel}>Time zone</dt>
            <dd className={styles.rowValue}>{APP_CONFIG.timezone}</dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.rowLabel}>Version</dt>
            <dd className={styles.rowValue}>{APP_CONFIG.version}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>About &amp; legal</h3>
        <p className={styles.hint}>
          Application information, Privacy Policy and Terms &amp; Regulations.
          {' '}
          {VENDOR.poweredBy}.
        </p>
        {onOpenAbout ? (
          <div className={styles.actions}>
            <Button variant="secondary" onClick={onOpenAbout}>
              Open About
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
