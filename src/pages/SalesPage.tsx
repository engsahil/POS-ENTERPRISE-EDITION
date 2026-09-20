import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/app/routes';
import { PageHeader } from '@/components/layout/PageHeader';
import { SummaryCard, WeekChart } from '@/components/sales';
import { Button, EmptyState } from '@/components/ui';
import { SalesIcon } from '@/components/ui/Icons';
import { useSales } from '@/hooks/useSales';
import { formatMoney } from '@/utils/currency';
import { formatDate, formatTime } from '@/utils/date';
import styles from './SalesPage.module.css';

export default function SalesPage() {
  const navigate = useNavigate();
  const { overview, loading } = useSales();

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

  const { today, week, month, weekDays, recent } = overview;
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

        <section className={styles.recent}>
          <h2 className={styles.recentTitle}>Recent orders</h2>

          <ul className={styles.list}>
            {recent.map((sale) => (
              <li key={sale.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.orderNumber}>
                    #{sale.orderNumber}
                  </span>
                  <span className={styles.rowMeta}>
                    {sale.businessDate === todayKey
                      ? formatTime(sale.completedAt)
                      : formatDate(sale.completedAt)}{' '}
                    &middot; {sale.itemCount} item
                    {sale.itemCount === 1 ? '' : 's'}
                  </span>
                </div>
                <span className={styles.rowTotal}>
                  {formatMoney(sale.grandTotal)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
