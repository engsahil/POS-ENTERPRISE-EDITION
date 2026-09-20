import type { KitchenReceiptModel, ReceiptWidth } from '@/services/receiptService';
import styles from './Receipt.module.css';

export interface KitchenReceiptProps {
  model: KitchenReceiptModel;
  width: ReceiptWidth;
}

export function KitchenReceipt({ model, width }: KitchenReceiptProps) {
  return (
    <article
      className={`${styles.sheet} ${width === '58mm' ? styles.w58 : styles.w80}`}
      data-receipt-width={width}
      aria-label={`Kitchen receipt for order ${model.orderNumber}`}
    >
      <header className={styles.header}>
        <h1 className={styles.name}>KITCHEN</h1>
        <p className={styles.info}>Order #{model.orderNumber}</p>
      </header>

      <div className={styles.rule} />

      <dl className={styles.meta}>
        <div className={styles.metaRow}>
          <dt>Order</dt>
          <dd className={styles.metaValue}>#{model.orderNumber}</dd>
        </div>
        <div className={styles.metaRow}>
          <dt>Type</dt>
          <dd className={styles.metaValue}>{model.orderType}</dd>
        </div>
        {model.tableLabel ? (
          <div className={styles.metaRow}>
            <dt>Table</dt>
            <dd className={styles.metaValue}>{model.tableLabel}</dd>
          </div>
        ) : null}
        {model.customerName ? (
          <div className={styles.metaRow}>
            <dt>Customer</dt>
            <dd className={styles.metaValue}>{model.customerName}</dd>
          </div>
        ) : null}
        <div className={styles.metaRow}>
          <dt>Date</dt>
          <dd className={styles.metaValue}>{model.date}</dd>
        </div>
        <div className={styles.metaRow}>
          <dt>Time</dt>
          <dd className={styles.metaValue}>{model.time}</dd>
        </div>
      </dl>

      <div className={styles.rule} />

      <div className={styles.itemsHead} aria-hidden="true">
        <span className={styles.colItem}>Item</span>
        <span className={styles.colQty}>Qty</span>
        <span className={styles.colPrice}></span>
        <span className={styles.colTotal}></span>
      </div>

      <ul className={styles.items}>
        {model.lines.map((line) => (
          <li key={line.id} className={styles.item}>
            <div className={styles.itemRow}>
              <span className={styles.colItem}>
                <strong>{line.quantity}x {line.name}</strong>
                {line.sizeLabel ? <span className={styles.size}> ({line.sizeLabel})</span> : null}
                {line.isDeal ? <span className={styles.dealTag}> DEAL</span> : null}
              </span>
              <span className={styles.colQty}>{line.quantity}</span>
              <span className={styles.colPrice}></span>
              <span className={styles.colTotal}></span>
            </div>

            {line.toppings.length > 0 ? (
              <ul className={styles.dealContents}>
                {line.toppings.map((t, idx) => (
                  <li key={`top-${idx}`} className={styles.dealContent}>
                    + Topping: {t.name}
                  </li>
                ))}
              </ul>
            ) : null}

            {line.addOns.length > 0 ? (
              <ul className={styles.dealContents}>
                {line.addOns.map((a, idx) => (
                  <li key={`addon-${idx}`} className={styles.dealContent}>
                    + Add-on: {a.name}
                  </li>
                ))}
              </ul>
            ) : null}

            {line.isDeal && line.dealContents.length > 0 ? (
              <ul className={styles.dealContents}>
                {line.dealContents.map((entry, idx) => (
                  <li key={idx} className={styles.dealContent}>{entry}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>

      <div className={styles.rule} />

      <p className={styles.count}>
        {model.itemCount} item{model.itemCount === 1 ? '' : 's'} • {model.orderType}
        {model.tableLabel ? ` • Table ${model.tableLabel}` : ''}
      </p>

      {model.note ? <p className={styles.footer}>Note: {model.note}</p> : null}
    </article>
  );
}
