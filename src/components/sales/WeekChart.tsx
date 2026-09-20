import type { DayPoint } from '@/services/salesService';
import { formatMoney } from '@/utils/currency';
import styles from './WeekChart.module.css';

export interface WeekChartProps {
  days: DayPoint[];
}

/**
 * Daily totals for the current week.
 *
 * Plain CSS bars rather than a charting library: seven values do not justify
 * a dependency, and this keeps the runtime at three packages. Days with no
 * sales render as an empty track, so the week is never misleadingly compressed.
 */
export function WeekChart({ days }: WeekChartProps) {
  const peak = Math.max(...days.map((d) => d.total), 0);

  return (
    <div className={styles.wrapper}>
      <div className={styles.head}>
        <h2 className={styles.title}>This week</h2>
        {peak > 0 ? (
          <span className={styles.peak}>Peak {formatMoney(peak)}</span>
        ) : null}
      </div>

      <ul className={styles.chart}>
        {days.map((day) => {
          // Percentage of the busiest day. A day with sales gets a floor so
          // a small figure is never mistaken for an empty day; a day with no
          // sales renders no bar at all.
          const raw = peak > 0 ? (day.total / peak) * 100 : 0;
          const height = day.total > 0 ? Math.max(raw, 6) : 0;

          return (
            <li key={day.date} className={styles.column}>
              <div className={styles.track}>
                <div
                  className={`${styles.bar} ${day.isToday ? styles.barToday : ''}`}
                  style={{ height: `${height}%`, display: height ? undefined : 'none' }}
                  role="img"
                  aria-label={`${day.label}: ${formatMoney(day.total)} from ${
                    day.orderCount
                  } order${day.orderCount === 1 ? '' : 's'}`}
                />
              </div>

              <span
                className={`${styles.label} ${
                  day.isToday ? styles.labelToday : ''
                }`}
              >
                {day.label}
              </span>
              <span className={styles.value}>
                {day.total > 0 ? formatMoney(day.total, { withSymbol: false }) : '-'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
