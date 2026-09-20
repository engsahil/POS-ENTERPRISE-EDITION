import type { PeriodSummary } from '@/services/salesService';
import { formatMoney } from '@/utils/currency';
import styles from './SummaryCard.module.css';

export interface SummaryCardProps {
  summary: PeriodSummary;
  /** Emphasised styling for the headline period. */
  primary?: boolean;
}

/**
 * One period's figures.
 *
 * Shows only what was actually recorded: total, order count and average.
 * No targets, trends or comparisons are invented.
 */
export function SummaryCard({ summary, primary }: SummaryCardProps) {
  const { total, orderCount, itemCount, averageOrder } = summary;

  return (
    <article className={`${styles.card} ${primary ? styles.primary : ''}`}>
      <h2 className={styles.label}>{summary.label}</h2>

      <p className={styles.total}>{formatMoney(total)}</p>

      <dl className={styles.meta}>
        <div className={styles.metaRow}>
          <dt>Orders</dt>
          <dd>{orderCount}</dd>
        </div>
        <div className={styles.metaRow}>
          <dt>Items</dt>
          <dd>{itemCount}</dd>
        </div>
        <div className={styles.metaRow}>
          <dt>Average</dt>
          <dd>{formatMoney(averageOrder)}</dd>
        </div>
      </dl>
    </article>
  );
}
