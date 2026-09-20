import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Icon rendered inside the field, before the text. */
  leadingIcon?: ReactNode;
  /** Visible label. Omit only when an aria-label is supplied. */
  label?: string;
  hint?: string;
  invalid?: boolean;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leadingIcon, label, hint, invalid, fullWidth, className, id, ...props },
  ref,
) {
  const inputId = id ?? props.name;
  const hintId = hint && inputId ? `${inputId}-hint` : undefined;

  return (
    <div className={cn(styles.wrapper, fullWidth && styles.fullWidth)}>
      {label ? (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      ) : null}

      <div
        className={cn(
          styles.field,
          leadingIcon && styles.hasLeading,
          invalid && styles.invalid,
        )}
      >
        {leadingIcon ? (
          <span className={styles.leading} aria-hidden="true">
            {leadingIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(styles.input, className)}
          aria-invalid={invalid || undefined}
          aria-describedby={hintId}
          {...props}
        />
      </div>

      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
});
