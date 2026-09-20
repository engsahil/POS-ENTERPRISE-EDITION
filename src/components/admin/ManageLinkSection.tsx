import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import styles from './PanelSection.module.css';

export interface ManageLinkSectionProps {
  title: string;
  description: string;
  /** Live summary lines, e.g. "12 items - 10 available". */
  stats: { label: string; value: string | number }[];
  actionLabel: string;
  path: string;
}

/**
 * Admin entry point for a feature that owns its own full screen.
 *
 * Shows live counts and links out rather than duplicating the management UI,
 * so there is exactly one implementation of each feature.
 */
export function ManageLinkSection({
  title,
  description,
  stats,
  actionLabel,
  path,
}: ManageLinkSectionProps) {
  const navigate = useNavigate();

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>{title}</h3>
        <p className={styles.hint}>{description}</p>

        <dl className={styles.details}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.row}>
              <dt className={styles.rowLabel}>{stat.label}</dt>
              <dd className={styles.rowValue}>{stat.value}</dd>
            </div>
          ))}
        </dl>

        <div className={styles.actions}>
          <Button onClick={() => navigate(path)}>{actionLabel}</Button>
        </div>
      </section>
    </div>
  );
}
