import { useEffect, useState } from 'react';
import { Button, Input } from '@/components/ui';
import { CloseIcon, MinusIcon, PlusIcon } from '@/components/ui/Icons';
import {
  lineDiscount,
  lineTotal,
  type CartLine,
  type CartTotals,
} from '@/services/orderService';
import { formatMoney, parseMoney } from '@/utils/currency';
import { PAYMENT_METHOD_OPTIONS } from '@/utils/payment';
import type { Paisa } from '@/types/common';
import type { PaymentMethod } from '@/types/domain';
import { useToppings } from '@/hooks/useToppings';
import { useAddOns } from '@/hooks/useAddOns';
import type { SelectedAddOn, SelectedTopping } from '@/types/domain';
import styles from './CartPanel.module.css';

export interface CartCompletionInput {
  amountPaid: Paisa;
  discount: Paisa;
  paymentMethod: PaymentMethod;
}

export interface CartPanelProps {
  lines: CartLine[];
  totals: CartTotals;
  completing: boolean;
  /** Push the typed discount into the cart so totals recalculate live. */
  onDiscountChange: (value: Paisa) => void;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
  onComplete: (input: CartCompletionInput) => void;
  onUpdateToppings: (key: string, toppings: SelectedTopping[]) => void;
  onUpdateAddOns: (key: string, addOns: SelectedAddOn[]) => void;
}

export function CartPanel({
  lines,
  totals,
  completing,
  onDiscountChange,
  onIncrement,
  onDecrement,
  onRemove,
  onClear,
  onComplete,
  onUpdateToppings,
  onUpdateAddOns,
}: CartPanelProps) {
  const empty = lines.length === 0;
  const { items: availableToppings } = useToppings(true);
  const { items: availableAddOns } = useAddOns(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [picker, setPicker] = useState<'toppings' | 'addons' | null>(null);

  /*
   * Customer paid amount. Empty means the customer pays the exact total,
   * which keeps the common case one tap; a typed amount immediately drives
   * the return calculation below.
   */
  const [paidText, setPaidText] = useState('');
  /* Discount entry, kept as text so partial input like "12." stays editable. */
  const [discountText, setDiscountText] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  useEffect(() => {
    if (lines.length === 0) {
      setPaidText('');
      setDiscountText('');
      setPaymentMethod('cash');
    }
  }, [lines.length]);

  // Push the typed discount into the cart so totals recalculate immediately.
  useEffect(() => {
    const parsed =
      discountText.trim() === '' ? 0 : (parseMoney(discountText) ?? 0);
    onDiscountChange(parsed);
  }, [discountText, onDiscountChange]);

  const total = totals.grandTotal;
  const paid: Paisa =
    paidText.trim() === '' ? total : (parseMoney(paidText) ?? total);
  const shortfall: Paisa =
    paidText.trim() === '' ? 0 : Math.max(0, total - paid);
  const returnAmount: Paisa = Math.max(0, paid - total);

  const enteredDiscount: Paisa =
    discountText.trim() === '' ? 0 : (parseMoney(discountText) ?? 0);
  // Item-level discounts already use part of the subtotal, so the order
  // discount may only fill what is left.
  const discountRoom = Math.max(
    0,
    totals.subtotal - totals.itemDiscountTotal,
  );
  const discountInvalid = enteredDiscount > discountRoom;

  function handlePaidChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    // Digits and at most one decimal point — same rule as PriceInput.
    if (next !== '' && !/^\d*\.?\d{0,2}$/.test(next)) return;
    setPaidText(next);
  }

  function handleDiscountChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    if (next !== '' && !/^\d*\.?\d{0,2}$/.test(next)) return;
    setDiscountText(next);
  }

  function toggleExpand(key: string, type: 'toppings' | 'addons') {
    if (expanded === key && picker === type) {
      setExpanded(null);
      setPicker(null);
    } else {
      setExpanded(key);
      setPicker(type);
    }
  }

  function toggleTopping(line: CartLine, name: string, price: number) {
    const exists = line.toppings.some((t) => t.name === name);
    const next = exists
      ? line.toppings.filter((t) => t.name !== name)
      : [...line.toppings, { name, price }];
    onUpdateToppings(line.key, next);
  }

  function toggleAddOn(line: CartLine, name: string, price: number) {
    const exists = line.addOns.some((a) => a.name === name);
    const next = exists
      ? line.addOns.filter((a) => a.name !== name)
      : [...line.addOns, { name, price }];
    onUpdateAddOns(line.key, next);
  }

  return (
    <aside className={styles.panel} aria-label="Current order">
      <header className={styles.header}>
        <h2 className={styles.title}>Current order</h2>
        {!empty ? (
          <span className={styles.count}>
            {totals.itemCount} item{totals.itemCount === 1 ? '' : 's'}
          </span>
        ) : null}
      </header>

      {empty ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>No items yet</p>
          <p className={styles.emptyHint}>
            Tap a size on an item to add it to the order.
          </p>
        </div>
      ) : (
        <ul className={styles.lines}>
          {lines.map((line) => {
            const label = line.sizeLabel ? `${line.name} ${line.sizeLabel}` : line.name;
            const isExpanded = expanded === line.key;
            const itemSaving = lineDiscount(line);
            const lineGross = lineTotal(line);

            return (
              <li key={line.key} className={styles.line}>
                <div className={styles.lineMain}>
                  <span className={styles.lineName}>{line.name}</span>
                  <span className={styles.lineMeta}>
                    {line.sizeLabel ? `${line.sizeLabel} · ${formatMoney(line.unitPrice)}` : formatMoney(line.unitPrice)}
                    {line.toppings.length > 0 ? ` • Toppings: ${line.toppings.map((t) => t.name).join(', ')}` : ''}
                    {line.addOns.length > 0 ? ` • Add-ons: ${line.addOns.map((a) => a.name).join(', ')}` : ''}
                    {itemSaving > 0 ? ` • ${line.discountPercent}% off` : ''}
                  </span>
                </div>

                <div className={styles.lineControls}>
                  <div className={styles.stepper}>
                    <button
                      type="button"
                      className={styles.stepButton}
                      onClick={() => onDecrement(line.key)}
                      aria-label={`Decrease ${label} quantity`}
                    >
                      <MinusIcon width={14} height={14} />
                    </button>
                    <span className={styles.quantity}>{line.quantity}</span>
                    <button
                      type="button"
                      className={styles.stepButton}
                      onClick={() => onIncrement(line.key)}
                      aria-label={`Increase ${label} quantity`}
                    >
                      <PlusIcon width={14} height={14} />
                    </button>
                  </div>

                  <span className={styles.lineTotal}>
                    {formatMoney(
                      itemSaving > 0 ? lineGross - itemSaving : lineGross,
                    )}
                  </span>

                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => onRemove(line.key)}
                    aria-label={`Remove ${label}`}
                  >
                    <CloseIcon width={15} height={15} />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  <button
                    type="button"
                    className={styles.stepButton}
                    style={{ width: 'auto', padding: '0 8px', border: '1px solid var(--color-border)', borderRadius: '6px' }}
                    onClick={() => toggleExpand(line.key, 'toppings')}
                  >
                    Toppings{line.toppings.length ? ` (${line.toppings.length})` : ''}
                  </button>
                  <button
                    type="button"
                    className={styles.stepButton}
                    style={{ width: 'auto', padding: '0 8px', border: '1px solid var(--color-border)', borderRadius: '6px' }}
                    onClick={() => toggleExpand(line.key, 'addons')}
                  >
                    Add-ons{line.addOns.length ? ` (${line.addOns.length})` : ''}
                  </button>
                </div>

                {isExpanded && picker === 'toppings' ? (
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--color-surface-alt)' }}>
                    {availableToppings.length === 0 ? (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>No toppings configured. Add in Admin → Toppings.</span>
                    ) : (
                      availableToppings.map((t) => {
                        const selected = line.toppings.some((x) => x.name === t.name);
                        return (
                          <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleTopping(line, t.name, t.price)}
                            />
                            <span>{t.name} {t.price > 0 ? `(+${formatMoney(t.price)})` : ''}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                ) : null}

                {isExpanded && picker === 'addons' ? (
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--color-surface-alt)' }}>
                    {availableAddOns.length === 0 ? (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>No add-ons configured. Add in Admin → Add-ons.</span>
                    ) : (
                      availableAddOns.map((a) => {
                        const selected = line.addOns.some((x) => x.name === a.name);
                        return (
                          <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleAddOn(line, a.name, a.price)}
                            />
                            <span>{a.name} {a.price > 0 ? `(+${formatMoney(a.price)})` : ''}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <footer className={styles.footer}>
        <dl className={styles.totals}>
          <div className={styles.totalRow}>
            <dt>Subtotal</dt>
            <dd>{formatMoney(totals.subtotal)}</dd>
          </div>

          {totals.discountTotal > 0 ? (
            <div className={`${styles.totalRow} ${styles.discountRow}`}>
              <dt>Discount</dt>
              <dd>-{formatMoney(totals.discountTotal)}</dd>
            </div>
          ) : null}

          {totals.taxPercent > 0 ? (
            <div className={styles.totalRow}>
              <dt>
                Tax ({totals.taxPercent}%
                {totals.taxInclusive ? ', included' : ''})
              </dt>
              <dd>{formatMoney(totals.taxTotal)}</dd>
            </div>
          ) : null}

          <div className={`${styles.totalRow} ${styles.grandRow}`}>
            <dt>Total</dt>
            <dd className={styles.grandValue}>
              {formatMoney(totals.grandTotal)}
            </dd>
          </div>
        </dl>

        {!empty ? (
          <div className={styles.payment}>
            <Input
              label="Discount"
              name="discount"
              value={discountText}
              onChange={handleDiscountChange}
              placeholder={`0 (max ${formatMoney(discountRoom)})`}
              inputMode="decimal"
              autoComplete="off"
              disabled={completing}
              invalid={discountInvalid}
              hint={
                discountInvalid
                  ? `Discount cannot exceed ${formatMoney(discountRoom)}.`
                  : undefined
              }
              fullWidth
            />
            <Input
              label="Customer paid"
              name="amountPaid"
              value={paidText}
              onChange={handlePaidChange}
              placeholder={formatMoney(total)}
              inputMode="decimal"
              autoComplete="off"
              disabled={completing}
              invalid={shortfall > 0}
              hint={
                shortfall > 0 ? `Short by ${formatMoney(shortfall)}.` : undefined
              }
              fullWidth
            />
            <div className={styles.returnRow}>
              <span className={styles.returnLabel}>Return / Change</span>
              <span
                className={
                  returnAmount > 0
                    ? `${styles.returnValue} ${styles.returnValueActive}`
                    : styles.returnValue
                }
              >
                {formatMoney(returnAmount)}
              </span>
            </div>

            <div
              className={styles.methods}
              role="radiogroup"
              aria-label="Payment method"
            >
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <label key={option.value} className={styles.method}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    className={styles.methodInput}
                    checked={paymentMethod === option.value}
                    onChange={() => setPaymentMethod(option.value)}
                    disabled={completing}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className={styles.actions}>
          <Button
            variant="ghost"
            onClick={onClear}
            disabled={empty || completing}
          >
            Clear
          </Button>
          <Button
            onClick={() =>
              onComplete({
                amountPaid: paid,
                // Only the discount typed here: item-level discounts are
                // recomputed from the lines themselves inside complete().
                discount: enteredDiscount,
                paymentMethod,
              })
            }
            disabled={empty || completing || shortfall > 0 || discountInvalid}
            fullWidth
          >
            {completing ? 'Completing' : 'Complete order'}
          </Button>
        </div>
      </footer>
    </aside>
  );
}
