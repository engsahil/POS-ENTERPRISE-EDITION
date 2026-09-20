import { useEffect, useState } from 'react';
import { Input } from '@/components/ui';
import { CURRENCY } from '@/config/app.config';
import type { Paisa } from '@/types/common';
import { parseMoney, toRupees } from '@/utils/currency';

export interface PriceInputProps {
  label: string;
  name: string;
  /** Integer paisa, or null when this size is not offered. */
  value: Paisa | null;
  onChange: (value: Paisa | null) => void;
  invalid?: boolean;
  hint?: string;
  disabled?: boolean;
}

/** Show paisa as a plain rupee figure for editing (no symbol, no grouping). */
function toText(value: Paisa | null): string {
  if (value === null) return '';
  const rupees = toRupees(value);
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
}

/**
 * Money field for Pakistani Rupees.
 *
 * Keeps its own text state so partial input like "12." stays editable, and
 * reports integer paisa upward. An empty field means "not offered", not zero.
 */
export function PriceInput({
  label,
  name,
  value,
  onChange,
  invalid,
  hint,
  disabled,
}: PriceInputProps) {
  const [text, setText] = useState(() => toText(value));

  // Re-sync when the parent changes the value (load, reset, discard).
  useEffect(() => {
    setText((current) =>
      parseMoney(current) === value && current.trim() !== ''
        ? current
        : toText(value),
    );
  }, [value]);

  return (
    <Input
      label={label}
      name={name}
      value={text}
      onChange={(event) => {
        const next = event.target.value;
        // Digits and at most one decimal point.
        if (next !== '' && !/^\d*\.?\d{0,2}$/.test(next)) return;

        setText(next);
        onChange(next.trim() === '' ? null : parseMoney(next));
      }}
      onBlur={() => setText(toText(value))}
      disabled={disabled}
      inputMode="decimal"
      autoComplete="off"
      placeholder={CURRENCY.symbol}
      invalid={invalid}
      hint={hint}
      fullWidth
    />
  );
}
