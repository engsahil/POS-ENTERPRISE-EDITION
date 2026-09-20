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

  function printBoth() {
    const container = document.createElement('div');
    container.style.background = '#fff';

    if (customerRef.current) {
      const custClone = customerRef.current.firstElementChild?.cloneNode(true) as HTMLElement;
      if (custClone) {
        container.appendChild(custClone);
        const spacer = document.createElement('div');
        spacer.style.height = '10mm';
        spacer.style.pageBreakAfter = 'always';
        container.appendChild(spacer);
      }
    }
    if (kitchenRef.current) {
      const kitClone = kitchenRef.current.firstElementChild?.cloneNode(true) as HTMLElement;
      if (kitClone) {
        container.appendChild(kitClone);
      }
    }

    if (!container.hasChildNodes()) {
      // fallback: use current
      printReceipt({ width: width as ReceiptWidth, container: currentRef.current });
      return;
    }

    container.classList.add('print-root');
    document.body.appendChild(container);

    const style = document.createElement('style');
    style.id = 'thermal-both';
    style.media = 'print';
    style.textContent = `@page { size: ${width} auto; margin: 0; }`;
    document.head.appendChild(style);

    const restore = () => {
      container.remove();
      style.remove();
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
    setTimeout(() => {
      if (container.parentNode) restore();
    }, 1000);
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
