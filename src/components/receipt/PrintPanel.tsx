import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import {
  printerService,
  type TransportKind,
  type TransportSupport,
} from '@/services/printerService';
import { renderPlainText } from '@/services/escpos';
import type { ReceiptModel, ReceiptWidth } from '@/services/receiptService';
import styles from './PrintPanel.module.css';

export interface PrintPanelProps {
  model: ReceiptModel;
  width: ReceiptWidth;
  onClose: () => void;
}

/**
 * Direct-printer controls.
 *
 * Deliberately separate from the browser Print button, and worded so the two
 * are not confused: browser printing goes through the OS dialog and driver;
 * this sends ESC/POS bytes straight to the device.
 */
export function PrintPanel({ model, width, onClose }: PrintPanelProps) {
  const [support, setSupport] = useState<TransportSupport | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(
    printerService.activeTransport()?.label ?? null,
  );
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    setSupport(printerService.detectSupport());
  }, []);

  const bytes = printerService.encode(model, width);
  const plain = renderPlainText(model, width);

  async function connect(kind: TransportKind) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const transport = await printerService.connect(kind);
      setConnected(transport.label);
      setStatus(`Connected to ${transport.label}.`);
    } catch (err) {
      // A user cancelling the device picker is not an error worth shouting about.
      const message = err instanceof Error ? err.message : String(err);
      setError(/No device selected|cancelled/i.test(message)
        ? 'No printer was selected.'
        : message);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await printerService.printReceipt(model, width);
      setStatus('Receipt sent to the printer.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send to printer.');
    } finally {
      setBusy(false);
    }
  }

  function download() {
    // Copy into a plain ArrayBuffer so the Blob accepts it.
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${model.orderNumber}-${width}.bin`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const usbUsable = support?.usb && support.secureContext;
  const serialUsable = support?.serial && support.secureContext;

  return (
    <section className={styles.panel} aria-label="Direct printer">
      <header className={styles.head}>
        <h2 className={styles.title}>Thermal printer</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </header>

      <p className={styles.explain}>
        Sends ESC/POS commands straight to the printer, with no operating
        system print dialog. This is a different path from the{' '}
        <strong>Print</strong> button, which uses the browser and the
        printer&apos;s driver.
      </p>

      <dl className={styles.support}>
        <div className={styles.supportRow}>
          <dt>Paper</dt>
          <dd>
            {width} &middot; {width === '58mm' ? 32 : 48} columns
          </dd>
        </div>
        <div className={styles.supportRow}>
          <dt>WebUSB</dt>
          <dd>{support?.usb ? 'Available' : 'Not supported'}</dd>
        </div>
        <div className={styles.supportRow}>
          <dt>Web Serial</dt>
          <dd>{support?.serial ? 'Available' : 'Not supported'}</dd>
        </div>
        <div className={styles.supportRow}>
          <dt>Secure context</dt>
          <dd>{support?.secureContext ? 'Yes' : 'No (HTTPS required)'}</dd>
        </div>
        <div className={styles.supportRow}>
          <dt>Connection</dt>
          <dd>{connected ?? 'Not connected'}</dd>
        </div>
      </dl>

      {!support?.secureContext ? (
        <p className={styles.note}>
          Direct printing needs a secure context. Serve the app over HTTPS (or
          use localhost) to enable it.
        </p>
      ) : !support.usb && !support.serial ? (
        <p className={styles.note}>
          This browser does not expose WebUSB or Web Serial. Chrome or Edge on
          desktop is required for direct printing; the browser Print button
          works everywhere.
        </p>
      ) : null}

      <div className={styles.actions}>
        <Button
          variant="secondary"
          onClick={() => void connect('usb')}
          disabled={busy || !usbUsable}
        >
          Connect USB
        </Button>
        <Button
          variant="secondary"
          onClick={() => void connect('serial')}
          disabled={busy || !serialUsable}
        >
          Connect Serial
        </Button>
        <Button onClick={() => void send()} disabled={busy || !connected}>
          {busy ? 'Sending' : 'Send to printer'}
        </Button>
      </div>

      {status ? (
        <p className={styles.status} role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.tools}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPreview((v) => !v)}
          aria-expanded={preview}
        >
          {preview ? 'Hide' : 'Show'} printer output
        </Button>
        <Button variant="ghost" size="sm" onClick={download}>
          Download .bin ({bytes.length} bytes)
        </Button>
      </div>

      {preview ? (
        <div className={styles.previewWrap}>
          <p className={styles.previewLabel}>
            Exactly what the printer will render, at {width === '58mm' ? 32 : 48}{' '}
            columns:
          </p>
          <pre className={styles.preview} data-testid="escpos-preview">
            {plain}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
