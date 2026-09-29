import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/app/routes';
import { PageHeader } from '@/components/layout/PageHeader';
import { SummaryCard, WeekChart } from '@/components/sales';
import { Button, EmptyState } from '@/components/ui';
import { SalesIcon } from '@/components/ui/Icons';
import { notifyCustomersChanged } from '@/hooks/useCustomers';
import { notifyInventoryChanged } from '@/hooks/useInventory';
import { useSales, notifySalesChanged } from '@/hooks/useSales';
import { orderService } from '@/services/orderService';
import { formatMoney } from '@/utils/currency';
import { formatDate, formatTime } from '@/utils/date';
import { formatPaymentMethod } from '@/utils/payment';
import type { PaymentMethodTotals } from '@/services/salesService';
import styles from './SalesPage.module.css';

export default function SalesPage() {
  const navigate = useNavigate();
  const { overview, loading, reload } = useSales();
  /** Sale waiting for a cancellation confirmation. */
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCancel(orderId: string) {
    setBusyId(orderId);
    setConfirmId(null);
    try {
      await orderService.cancel(orderId);
      await reload();
      notifySalesChanged();
      notifyInventoryChanged();
      notifyCustomersChanged();
    } catch {
      /* stay on the page; the row simply remains completed */
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Sales" subtitle="Daily, weekly and monthly totals." />
        <p className={styles.loading}>Loading sales…</p>
      </div>
    );
  }

  // Nothing recorded yet: say so plainly rather than showing zeroed cards
  // that look like a broken dashboard.
  if (!overview || overview.isEmpty) {
    return (
      <div className="page">
        <PageHeader title="Sales" subtitle="Daily, weekly and monthly totals." />
        <EmptyState
          fill
          icon={<SalesIcon />}
          title="No sales yet"
          description="Totals appear here as soon as you complete an order. Nothing is estimated: every figure comes from saved orders."
          action={
            <Button variant="secondary" onClick={() => navigate(ROUTE_PATHS.pos)}>
              Go to POS
            </Button>
          }
        />
      </div>
    );
  }

  const { today, week, month, weekDays, paymentFlow, recent } = overview;
  const todayKey = today.from;

  return (
    <div className="page">
      <PageHeader
        title="Sales"
        subtitle="Daily, weekly and monthly totals from saved orders."
      />

      <div className={styles.stack}>
        <section className={styles.cards}>
          <SummaryCard summary={today} primary />
          <SummaryCard summary={week} />
          <SummaryCard summary={month} />
        </section>

        <WeekChart days={weekDays} />

        {/* Money actually received, straight from completed sales. */}
        <section className={styles.cashflow} aria-label="Cash flow">
          <div className={styles.cashflowHead}>
            <h2 className={styles.recentTitle}>Cash flow</h2>
            <p className={styles.cashflowNote}>
              Received per payment method from completed sales. Cancelled
              orders are excluded.
            </p>
          </div>
          <div className={styles.flowGrid} role="table">
            <div className={styles.flowRow} role="row">
              <span className={styles.flowLabel} role="columnheader">
                Method
              </span>
              <span className={styles.flowValue} role="columnheader">
                Today
              </span>
              <span className={styles.flowValue} role="columnheader">
                This week
              </span>
              <span className={styles.flowValue} role="columnheader">
                All time
              </span>
            </div>
            {[
              ['Cash', 'cash'],
              ['Card', 'card'],
              ['Digital Payment', 'digital'],
              ['Other', 'other'],
            ].map(([label, key]) => (
              <div key={key} className={styles.flowRow} role="row">
                <span className={styles.flowLabel} role="cell">
                  {label}
                </span>
                <span className={styles.flowValue} role="cell">
                  {formatMoney(paymentFlow.today[key as keyof PaymentMethodTotals])}
                </span>
                <span className={styles.flowValue} role="cell">
                  {formatMoney(paymentFlow.week[key as keyof PaymentMethodTotals])}
                </span>
                <span className={styles.flowValue} role="cell">
                  {formatMoney(paymentFlow.all[key as keyof PaymentMethodTotals])}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.recent}>
          <h2 className={styles.recentTitle}>Recent orders</h2>

          <ul className={styles.list}>
            {recent.map((sale) => {
              const cancelled = Boolean(sale.cancelledAt);
              const confirming = confirmId === sale.id;
              return (
                <li
                  key={sale.id}
                  className={cancelled ? `${styles.row} ${styles.rowCancelled}` : styles.row}
                >
                  <div className={styles.rowMain}>
                    <span className={styles.orderNumberRow}>
                      <span className={styles.orderNumber}>#{sale.orderNumber}</span>
                      {cancelled ? (
                        <span className={styles.cancelledBadge}>Cancelled</span>
                      ) : null}
                    </span>
                    <span className={styles.rowMeta}>
                      {sale.businessDate === todayKey
                        ? formatTime(sale.completedAt)
                        : formatDate(sale.completedAt)}{' '}
                      &middot; {sale.itemCount} item
                      {sale.itemCount === 1 ? '' : 's'}
                      {' \u00b7 '}
                      {formatPaymentMethod(sale.paymentMethod)}
                      {sale.discountTotal > 0 ? (
                        <>
                          {' \u00b7 '}Discount {formatMoney(sale.discountTotal)}
                        </>
                      ) : null}
                    </span>
                  </div>

                  <span className={styles.rowActions}>
                    {!cancelled ? (
                      confirming ? (
                        <>
                          <span className={styles.confirmText}>
                            Cancel this order?
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmId(null)}
                            disabled={busyId === sale.orderId}
                          >
                            No
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => void handleCancel(sale.orderId)}
                            disabled={busyId === sale.orderId}
                          >
                            Yes, cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmId(sale.id)}
                          disabled={busyId === sale.orderId}
                        >
                          Cancel
                        </Button>
                      )
                    ) : null}
                    <span className={styles.rowTotal}>
                      {formatMoney(sale.grandTotal)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
