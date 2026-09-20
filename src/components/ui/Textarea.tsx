import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
import styles from './Textarea.module.css';

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Visible label. Omit only when an aria-label is supplied. */
  label?: string;
  hint?: string;
  invalid?: boolean;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { label, hint, invalid, fullWidth, className, id, rows = 3, ...props },
    ref,
  ) {
    const fieldId = id ?? props.name;
    const hintId = hint && fieldId ? `${fieldId}-hint` : undefined;

    return (
      <div className={cn(styles.wrapper, fullWidth && styles.fullWidth)}>
        {label ? (
          <label className={styles.label} htmlFor={fieldId}>
            {label}
          </label>
        ) : null}

        <div className={cn(styles.field, invalid && styles.invalid)}>
          <textarea
            ref={ref}
            id={fieldId}
            rows={rows}
            className={cn(styles.textarea, className)}
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
  },
);
