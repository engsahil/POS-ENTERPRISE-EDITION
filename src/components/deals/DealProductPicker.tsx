import { useState } from 'react';
import { Button } from '@/components/ui';
import { PlusIcon, TrashIcon } from '@/components/ui/Icons';
import {
  type MenuItemWithPrices,
} from '@/services/menuService';
import type { DealLine } from '@/types/domain';
import { formatMoney } from '@/utils/currency';
import styles from './DealProductPicker.module.css';

export interface DealProductPickerProps {
  menuItems: MenuItemWithPrices[];
  value: DealLine[];
  onChange: (lines: DealLine[]) => void;
  disabled?: boolean;
}

/** Variant labels that actually carry a price for a given item. */
function pricedSizes(entry: MenuItemWithPrices): string[] {
  return entry.availableSizes;
}

export function DealProductPicker({
  menuItems,
  value,
  onChange,
  disabled,
}: DealProductPickerProps) {
  const [pendingItem, setPendingItem] = useState('');
  const [pendingSize, setPendingSize] = useState('');

  const selectedEntry = menuItems.find((e) => e.item.id === pendingItem);
  const sizeOptions = selectedEntry ? pricedSizes(selectedEntry) : [];

  function add() {
    if (!selectedEntry) return;
    const size = pendingSize || sizeOptions[0] || '';
    if (!size) return;

    const existing = value.find(
      (l) => l.menuItemId === selectedEntry.item.id && l.sizeLabel === size,
    );

    // Adding the same product and size again bumps its quantity.
    onChange(
      existing
        ? value.map((l) =>
            l === existing ? { ...l, quantity: l.quantity + 1 } : l,
          )
        : [
            ...value,
            {
              menuItemId: selectedEntry.item.id,
              sizeLabel: size,
              quantity: 1,
            },
          ],
    );

    setPendingItem('');
    setPendingSize('');
  }

  function setQuantity(index: number, quantity: number) {
    onChange(
      quantity <= 0
        ? value.filter((_, i) => i !== index)
        : value.map((l, i) => (i === index ? { ...l, quantity } : l)),
    );
  }

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>Included products</span>

      {value.length === 0 ? (
        <p className={styles.empty}>
          No products added yet. A deal needs at least one product.
        </p>
      ) : (
        <ul className={styles.lines}>
          {value.map((line, index) => {
            const entry = menuItems.find((e) => e.item.id === line.menuItemId);
            const unit = entry
              ? (entry.prices[line.sizeLabel] ?? null)
              : null;

            return (
              <li key={`${line.menuItemId}-${line.sizeLabel}`} className={styles.line}>
                <div className={styles.lineMain}>
                  <span className={styles.lineName}>
                    {entry?.item.name ?? 'Item no longer on the menu'}
                  </span>
                  <span className={styles.lineMeta}>
                    {line.sizeLabel}
                    {unit !== null ? ` · ${formatMoney(unit)}` : ' · no price'}
                  </span>
                </div>

                <div className={styles.lineControls}>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={line.quantity}
                    disabled={disabled}
                    className={styles.qty}
                    aria-label={`Quantity of ${entry?.item.name ?? 'item'} ${line.sizeLabel}`}
                    onChange={(e) =>
                      setQuantity(index, Number(e.target.value) || 0)
                    }
                  />

                  <span className={styles.lineTotal}>
                    {unit !== null ? formatMoney(unit * line.quantity) : '--'}
                  </span>

                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    disabled={disabled}
                    aria-label={`Remove ${entry?.item.name ?? 'item'} from deal`}
                    onClick={() => setQuantity(index, 0)}
                  >
                    <TrashIcon width={16} height={16} />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {menuItems.length === 0 ? (
        <p className={styles.hint}>
          Add menu items first, then include them in a deal.
        </p>
      ) : (
        <div className={styles.picker}>
          <div className={styles.selectField}>
            <select
              className={styles.select}
              name="dealProduct"
              aria-label="Product to add"
              value={pendingItem}
              disabled={disabled}
              onChange={(e) => {
                setPendingItem(e.target.value);
                setPendingSize('');
              }}
            >
              <option value="">Select a product</option>
              {menuItems.map((entry) => (
                <option key={entry.item.id} value={entry.item.id}>
                  {entry.item.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.selectField}>
            <select
              className={styles.select}
              name="dealProductSize"
              aria-label="Size to add"
              value={pendingSize}
              disabled={disabled || !selectedEntry}
              onChange={(e) => setPendingSize(e.target.value)}
            >
              {sizeOptions.length === 0 ? (
                <option value="">Size</option>
              ) : (
                sizeOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))
              )}
            </select>
          </div>

          <Button
            variant="secondary"
            onClick={add}
            disabled={disabled || !selectedEntry || sizeOptions.length === 0}
            leadingIcon={<PlusIcon width={16} height={16} />}
          >
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
