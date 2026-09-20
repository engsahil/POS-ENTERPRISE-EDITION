import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Primary call to action. */
  action?: ReactNode;
  /** Fills the available height instead of using intrinsic height. */
  fill?: boolean;
  className?: string;
}

/**
 * Neutral placeholder for screens with nothing to show yet.
 * Deliberately quiet: no borders competing with content, no invented metrics.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  fill = false,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(styles.wrapper, fill && styles.fill, className)}>
      <div className={styles.inner}>
        {icon ? (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <h2 className={styles.title}>{title}</h2>
        {description ? (
          <p className={styles.description}>{description}</p>
        ) : null}
        {action ? <div className={styles.action}>{action}</div> : null}
      </div>
    </div>
  );
}
