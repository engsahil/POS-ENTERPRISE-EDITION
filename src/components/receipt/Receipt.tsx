import type { ReceiptModel, ReceiptWidth } from '@/services/receiptService';
import { formatMoney } from '@/utils/currency';
import { formatPaymentMethod } from '@/utils/payment';
import styles from './Receipt.module.css';

export interface ReceiptProps {
  model: ReceiptModel;
  width: ReceiptWidth;
}

export function Receipt({ model, width }: ReceiptProps) {
  const { header } = model;

  const hasContact = Boolean(header.address || header.phone || header.email);

  return (
    <article
      className={`${styles.sheet} ${
        width === '58mm' ? styles.w58 : styles.w80
      }`}
      data-receipt-width={width}
      aria-label={`Receipt for order ${model.orderNumber}`}
    >
      {/* ---------- Header ---------- */}
      <header className={styles.header}>
        {header.logo ? (
          <img
            src={header.logo.dataUrl}
            alt=""
            className={styles.logo}
          />
        ) : null}

        {header.name ? (
          <h1 className={styles.name}>{header.name}</h1>
        ) : null}

        {hasContact ? (
          <div className={styles.contact}>
            {header.address ? (
              <p className={styles.contactLine}>{header.address}</p>
            ) : null}
            {header.phone ? (
              <p className={styles.contactLine}>{header.phone}</p>
            ) : null}
            {header.email ? (
              <p className={styles.contactLine}>{header.email}</p>
            ) : null}
          </div>
        ) : null}

        {header.receiptInfo ? (
          <p className={styles.info}>{header.receiptInfo}</p>
        ) : null}
      </header>

      <div className={styles.rule} />

      {/* ---------- Order meta ---------- */}
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
        {model.customerPhone ? (
          <div className={styles.metaRow}>
            <dt>Phone</dt>
            <dd className={styles.metaValue}>{model.customerPhone}</dd>
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

      {/* ---------- Items ---------- */}
      <div className={styles.itemsHead} aria-hidden="true">
        <span className={styles.colItem}>Item</span>
        <span className={styles.colQty}>Qty</span>
        <span className={styles.colPrice}>Price</span>
        <span className={styles.colTotal}>Amount</span>
      </div>

      <ul className={styles.items}>
        {model.lines.map((line) => (
          <li key={line.id} className={styles.item}>
            <div className={styles.itemRow}>
              <span className={styles.colItem}>
                {line.name}
                {line.sizeLabel ? (
                  <span className={styles.size}> ({line.sizeLabel})</span>
                ) : null}
                {line.isDeal ? (
                  <span className={styles.dealTag}> DEAL</span>
                ) : null}
              </span>
              <span className={styles.colQty}>{line.quantity}</span>
              <span className={styles.colPrice}>
                {formatMoney(line.unitPrice, { withSymbol: false })}
              </span>
              <span className={styles.colTotal}>
                {formatMoney(line.lineTotal, { withSymbol: false })}
              </span>
            </div>

            {line.toppings.length > 0 ? (
              <ul className={styles.dealContents}>
                {line.toppings.map((t, idx) => (
                  <li key={`top-${idx}`} className={styles.dealContent}>
                    + {t.name} {t.price > 0 ? `(${formatMoney(t.price, { withSymbol: false })})` : ''}
                  </li>
                ))}
              </ul>
            ) : null}

            {line.addOns.length > 0 ? (
              <ul className={styles.dealContents}>
                {line.addOns.map((a, idx) => (
                  <li key={`addon-${idx}`} className={styles.dealContent}>
                    + {a.name} {a.price > 0 ? `(${formatMoney(a.price, { withSymbol: false })})` : ''}
                  </li>
                ))}
              </ul>
            ) : null}

            {line.isDeal && line.dealContents.length > 0 ? (
              <ul className={styles.dealContents}>
                {line.dealContents.map((entry, index) => (
                  <li key={index} className={styles.dealContent}>
                    {entry}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>

      <div className={styles.rule} />

      {/* ---------- Totals ---------- */}
      <dl className={styles.totals}>
        <div className={styles.totalRow}>
          <dt>Subtotal</dt>
          <dd>{formatMoney(model.subtotal)}</dd>
        </div>

        {model.discountTotal > 0 ? (
          <div className={styles.totalRow}>
            <dt>Discount</dt>
            <dd>-{formatMoney(model.discountTotal)}</dd>
          </div>
        ) : null}

        {model.savingsTotal > 0 ? (
          <div className={styles.totalRow}>
            <dt>Deal savings</dt>
            <dd>-{formatMoney(model.savingsTotal)}</dd>
          </div>
        ) : null}

        {model.taxTotal > 0 ? (
          <div className={styles.totalRow}>
            <dt>
              Tax{model.taxPercent > 0 ? ` (${model.taxPercent}%)` : ''}
            </dt>
            <dd>{formatMoney(model.taxTotal)}</dd>
          </div>
        ) : null}

        <div className={`${styles.totalRow} ${styles.grandRow}`}>
          <dt>TOTAL</dt>
          <dd>{formatMoney(model.grandTotal)}</dd>
        </div>

        {model.amountPaid != null ? (
          <>
            <div className={styles.totalRow}>
              <dt>Payment method</dt>
              <dd>{formatPaymentMethod(model.paymentMethod)}</dd>
            </div>
            <div className={styles.totalRow}>
              <dt>Paid</dt>
              <dd>{formatMoney(model.amountPaid)}</dd>
            </div>
          </>
        ) : null}

        {model.changeDue != null && model.changeDue > 0 ? (
          <div className={styles.totalRow}>
            <dt>Change</dt>
            <dd>{formatMoney(model.changeDue)}</dd>
          </div>
        ) : null}
      </dl>

      <div className={styles.rule} />

      <p className={styles.count}>
        {model.itemCount} item{model.itemCount === 1 ? '' : 's'}
      </p>

      {model.note ? (
        <p className={styles.footer}>Note: {model.note}</p>
      ) : null}

      {model.footer ? (
        <p className={styles.footer}>{model.footer}</p>
      ) : null}
    </article>
  );
}
