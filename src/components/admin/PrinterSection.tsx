import { useEffect, useState } from 'react';
import {
  RECEIPT_WIDTHS,
  receiptService,
  type ReceiptWidth,
} from '@/services/receiptService';
import { COLUMNS } from '@/services/escpos';
import {
  printerService,
  type TransportSupport,
} from '@/services/printerService';
import styles from './PanelSection.module.css';

/**
 * Default paper width plus a plain statement of what direct printing needs.
 *
 * The width saved here is what every new receipt opens with; it can still be
 * switched per receipt from the receipt view.
 */
export function PrinterSection() {
  const [width, setWidth] = useState<ReceiptWidth | null>(null);
  const [support, setSupport] = useState<TransportSupport | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    void receiptService.getWidth().then((w) => {
      if (active) setWidth(w);
    });
    setSupport(printerService.detectSupport());
    return () => {
      active = false;
    };
  }, []);

  async function choose(next: ReceiptWidth) {
    setWidth(next);
    await receiptService.setWidth(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  if (width === null) {
    return <p className={styles.loading}>Loading printer settings…</p>;
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>Paper width</h3>
          <span className={styles.status} aria-live="polite">
            {saved ? 'Saved' : ''}
          </span>
        </div>
        <p className={styles.hint}>
          Default width for new receipts. Individual receipts can still be
          switched from the receipt view.
        </p>

        <div className={styles.choices} role="group" aria-label="Paper width">
          {RECEIPT_WIDTHS.map((option) => (
            <button
              key={option}
              type="button"
              className={`${styles.choice} ${
                width === option ? styles.choiceActive : ''
              }`}
              aria-pressed={width === option}
              onClick={() => void choose(option)}
            >
              <span className={styles.choiceLabel}>{option}</span>
              <span className={styles.choiceMeta}>
                {COLUMNS[option]} characters
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Direct printing</h3>
        <p className={styles.hint}>
          ESC/POS sends commands straight to the printer, with no operating
          system dialog. It is offered from the receipt view once a receipt is
          on screen.
        </p>

        <dl className={styles.details}>
          <div className={styles.row}>
            <dt className={styles.rowLabel}>WebUSB</dt>
            <dd className={styles.rowValue}>
              {support?.usb ? 'Available' : 'Not supported'}
            </dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.rowLabel}>Web Serial</dt>
            <dd className={styles.rowValue}>
              {support?.serial ? 'Available' : 'Not supported'}
            </dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.rowLabel}>Secure context</dt>
            <dd className={styles.rowValue}>
              {support?.secureContext ? 'Yes' : 'No (HTTPS required)'}
            </dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.rowLabel}>Connection</dt>
            <dd className={styles.rowValue}>
              {printerService.activeTransport()?.label ?? 'Not connected'}
            </dd>
          </div>
        </dl>

        {!support?.secureContext || (!support.usb && !support.serial) ? (
          <p className={styles.note}>
            Direct printing needs Chrome or Edge on desktop, served over HTTPS
            or localhost. Browser printing works everywhere.
          </p>
        ) : null}
      </section>
    </div>
  );
}
