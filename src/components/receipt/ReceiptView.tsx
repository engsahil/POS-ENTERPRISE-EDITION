import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { printReceipt } from '@/services/printService';
import {
  RECEIPT_WIDTHS,
  receiptService,
  type KitchenReceiptModel,
  type ReceiptModel,
  type ReceiptWidth,
} from '@/services/receiptService';
import { PrintPanel } from './PrintPanel';
import { Receipt } from './Receipt';
import { KitchenReceipt } from './KitchenReceipt';
import styles from './ReceiptView.module.css';

export interface ReceiptViewProps {
  model: ReceiptModel;
  kitchenModel?: KitchenReceiptModel;
  actions?: React.ReactNode;
}

export function ReceiptView({ model, kitchenModel, actions }: ReceiptViewProps) {
  const [width, setWidth] = useState<ReceiptWidth | null>(null);
  const [showPrinter, setShowPrinter] = useState(false);
  const [activeTab, setActiveTab] = useState<'customer' | 'kitchen'>('customer');
  const customerRef = useRef<HTMLDivElement>(null);
  const kitchenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void receiptService.getWidth().then((stored) => {
      if (active) setWidth(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  function choose(next: ReceiptWidth) {
    setWidth(next);
    void receiptService.setWidth(next);
  }

  if (width === null) {
    return <p className={styles.loading}>Loading receipt…</p>;
  }

  const kitchen: KitchenReceiptModel = kitchenModel ?? {
    orderNumber: model.orderNumber,
    orderId: model.orderId,
    date: model.date,
    time: model.time,
    orderType: model.orderType,
    tableLabel: model.tableLabel,
    customerName: model.customerName,
    customerPhone: model.customerPhone,
    note: model.note,
    lines: model.lines,
    itemCount: model.itemCount,
  };

  const currentRef = activeTab === 'customer' ? customerRef : kitchenRef;

  /*
   * Print both receipts in one job.
   *
   * The two on-screen receipts are cloned into a single temporary container
   * and handed to the SAME printService pipeline a single receipt uses. That
   * is the whole fix for the double-print glitch: the previous
   * implementation built its own page style with `@page { size: <w> auto }`,
   * which is invalid CSS — browsers drop the descriptor entirely and print
   * on the default Letter/A4 sheet, stretching both receipts across it — and
   * forced a page break after the first receipt, which then produced a blank
   * trailing section. printService instead measures the real content height
   * and injects two explicit lengths (`size: 80mm 210mm`), so the pair prints
   * at the correct paper width with a tear line between them and no
   * duplicated, missing or overlapping content.
   */
  function printBoth() {
    const customerClone = customerRef.current?.firstElementChild?.cloneNode(
      true,
    ) as HTMLElement | null;
    const kitchenClone = kitchenRef.current?.firstElementChild?.cloneNode(
      true,
    ) as HTMLElement | null;

    // Nothing to clone (preview not mounted): print the visible receipt.
    if (!customerClone && !kitchenClone) {
      printReceipt({ width: width as ReceiptWidth, container: currentRef.current });
      return;
    }

    const container = document.createElement('div');
    if (customerClone) container.appendChild(customerClone);

    // Tear line between the two receipts. The print stylesheet zeroes
    // padding/margin/border on direct children of the print container, so
    // the styled line sits one level in where those resets do not reach.
    if (customerClone && kitchenClone) {
      const cutWrap = document.createElement('div');
      const cutLine = document.createElement('div');
      cutLine.className = styles.cutLine ?? '';
      cutWrap.appendChild(cutLine);
      container.appendChild(cutWrap);
    }

    if (kitchenClone) container.appendChild(kitchenClone);

    // The container is temporary — remove it once the job has finished so
    // nothing is left behind in the document for the next print.
    const cleanup = () => {
      container.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.setTimeout(cleanup, 2000);

    printReceipt({ width: width as ReceiptWidth, container });
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar} data-print-hide>
        <div className={styles.widths} role="group" aria-label="Receipt paper width">
          {RECEIPT_WIDTHS.map((option) => (
            <button
              key={option}
              type="button"
              className={`${styles.widthButton} ${width === option ? styles.widthActive : ''}`}
              aria-pressed={width === option}
              onClick={() => choose(option)}
            >
              {option}
            </button>
          ))}
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setShowPrinter((v) => !v)} aria-expanded={showPrinter}>
            Thermal printer
          </Button>
          <Button variant="secondary" onClick={() => printReceipt({ width: width as ReceiptWidth, container: currentRef.current })}>
            Print {activeTab === 'customer' ? 'Customer' : 'Kitchen'}
          </Button>
          <Button variant="secondary" onClick={printBoth}>
            Print Both
          </Button>
          {actions}
        </div>
      </div>

      <div className={styles.toolbar} data-print-hide>
        <div className={styles.widths} role="group" aria-label="Receipt type">
          <button
            type="button"
            className={`${styles.widthButton} ${activeTab === 'customer' ? styles.widthActive : ''}`}
            aria-pressed={activeTab === 'customer'}
            onClick={() => setActiveTab('customer')}
          >
            Customer Receipt
          </button>
          <button
            type="button"
            className={`${styles.widthButton} ${activeTab === 'kitchen' ? styles.widthActive : ''}`}
            aria-pressed={activeTab === 'kitchen'}
            onClick={() => setActiveTab('kitchen')}
          >
            Kitchen Receipt
          </button>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          Order #{model.orderNumber} • {model.orderType}
          {model.tableLabel ? ` • Table ${model.tableLabel}` : ''} • Same order
        </span>
      </div>

      {showPrinter ? (
        <div data-print-hide>
          <PrintPanel model={model} width={width} onClose={() => setShowPrinter(false)} />
        </div>
      ) : null}

      <div className={styles.paperArea}>
        <div className={styles.paper} ref={customerRef} style={{ display: activeTab === 'customer' ? 'block' : 'none' }}>
          <Receipt model={model} width={width} />
        </div>
        <div className={styles.paper} ref={kitchenRef} style={{ display: activeTab === 'kitchen' ? 'block' : 'none' }}>
          <KitchenReceipt model={kitchen} width={width} />
        </div>
      </div>
    </div>
  );
}
