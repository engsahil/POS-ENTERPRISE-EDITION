import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { CheckIcon } from '@/components/ui/Icons';
import { ReceiptView } from '@/components/receipt';
import type { CompletedOrder } from '@/services/orderService';
import { receiptService, type KitchenReceiptModel, type ReceiptModel } from '@/services/receiptService';
import { formatMoney } from '@/utils/currency';
import { formatTime } from '@/utils/date';
import styles from './OrderConfirmation.module.css';

export interface OrderConfirmationProps {
  completed: CompletedOrder;
  onNewOrder: () => void;
}

export function OrderConfirmation({
  completed,
  onNewOrder,
}: OrderConfirmationProps) {
  const { order, items } = completed;
  const [receipt, setReceipt] = useState<ReceiptModel | null>(null);
  const [kitchen, setKitchen] = useState<KitchenReceiptModel | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      receiptService.build(order, items),
      receiptService.buildKitchen(order, items),
    ]).then(([cust, kit]) => {
      if (active) {
        setReceipt(cust);
        setKitchen(kit);
      }
    });
    return () => {
      active = false;
    };
  }, [order, items]);

  if (receipt && kitchen) {
    return (
      <ReceiptView
        model={receipt}
        kitchenModel={kitchen}
        actions={<Button onClick={onNewOrder}>New order</Button>}
      />
    );
  }

  return (
    <div className={styles.wrapper} role="status">
      <div className={styles.card}>
        <span className={styles.icon} aria-hidden="true">
          <CheckIcon width={22} height={22} />
        </span>

        <h2 className={styles.title}>Order completed</h2>

        <p className={styles.orderNumber}>
          Order <strong>#{order.orderNumber}</strong> • {order.orderType}
          {order.tableLabel ? ` • Table ${order.tableLabel}` : ''}
        </p>
        <p className={styles.time}>
          {order.completedAt ? formatTime(order.completedAt) : null}
        </p>

        <ul className={styles.items}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <span className={styles.itemName}>
                {item.quantity} x {item.name}
                {item.sizeLabel ? ` (${item.sizeLabel})` : ''}
                {item.toppings?.length ? ` + ${item.toppings.map((t) => t.name).join(', ')}` : ''}
                {item.addOns?.length ? ` + ${item.addOns.map((a) => a.name).join(', ')}` : ''}
              </span>
              <span className={styles.itemTotal}>
                {formatMoney(item.lineTotal)}
              </span>
            </li>
          ))}
        </ul>

        <dl className={styles.totals}>
          <div className={styles.totalRow}>
            <dt>Subtotal</dt>
            <dd>{formatMoney(order.subtotal)}</dd>
          </div>
          {order.taxTotal > 0 ? (
            <div className={styles.totalRow}>
              <dt>Tax</dt>
              <dd>{formatMoney(order.taxTotal)}</dd>
            </div>
          ) : null}
          <div className={`${styles.totalRow} ${styles.grandRow}`}>
            <dt>Total</dt>
            <dd>{formatMoney(order.grandTotal)}</dd>
          </div>
          {order.amountPaid != null ? (
            <>
              <div className={styles.totalRow}>
                <dt>Paid</dt>
                <dd>{formatMoney(order.amountPaid)}</dd>
              </div>
              <div className={styles.totalRow}>
                <dt>Return / Change</dt>
                <dd>{formatMoney(order.changeDue ?? 0)}</dd>
              </div>
            </>
          ) : null}
        </dl>

        <Button onClick={onNewOrder} fullWidth>
          New order
        </Button>
      </div>
    </div>
  );
}
