import styles from './Spinner.module.css';

export interface SpinnerProps {
  label?: string;
  fullscreen?: boolean;
}

export function Spinner({ label = 'Loading', fullscreen }: SpinnerProps) {
  return (
    <div
      className={fullscreen ? styles.fullscreen : styles.inline}
      role="status"
      aria-live="polite"
    >
      <span className={styles.spinner} />
      <span className="u-visually-hidden">{label}</span>
    </div>
  );
}
