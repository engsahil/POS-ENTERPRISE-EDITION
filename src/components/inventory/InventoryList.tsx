import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { LinkIcon, MinusIcon, PlusIcon, TrashIcon } from '@/components/ui/Icons';
import type { InventoryItemView, StockStatus } from '@/services/inventoryService';
import styles from './InventoryList.module.css';

const STATUS_LABEL: Record<StockStatus, string> = {
  'out-of-stock': 'Out of stock',
  unavailable: 'Unavailable',
  'low-stock': 'Low stock',
  'in-stock': 'In stock',
};

const STATUS_CLASS: Record<StockStatus, string> = {
  'out-of-stock': 'statusOut',
  unavailable: 'statusUnavailable',
  'low-stock': 'statusLow',
  'in-stock': 'statusIn',
};

/** Trim trailing zeros so 2.500 shows as 2.5 and 3.0 as 3. */
function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value));
}

interface QuantityStepperProps {
  value: number;
  disabled?: boolean;
  label: string;
  onChange: (next: number) => void;
}

/** Inline quantity control with optimistic local state. */
function QuantityStepper({
  value,
  disabled,
  label,
  onChange,
}: QuantityStepperProps) {
  const [optimistic, setOptimistic] = useState(value);

  useEffect(() => {
    setOptimistic(value);
  }, [value]);

  const step = (delta: number) => {
    const next = Math.max(0, Number((optimistic + delta).toFixed(3)));
    setOptimistic(next);
    onChange(next);
  };

  return (
    <div className={styles.stepper}>
      <button
        type="button"
        className={styles.stepButton}
        onClick={() => step(-1)}
        disabled={disabled || optimistic <= 0}
        aria-label={`Decrease ${label} quantity`}
      >
        <MinusIcon width={15} height={15} />
      </button>

      <span className={styles.quantity} aria-live="polite">
        {formatQuantity(optimistic)}
      </span>

      <button
        type="button"
        className={styles.stepButton}
        onClick={() => step(1)}
        disabled={disabled}
        aria-label={`Increase ${label} quantity`}
      >
        <PlusIcon width={15} height={15} />
      </button>
    </div>
  );
}

export interface InventoryListProps {
  items: InventoryItemView[];
  busyId?: string | null;
  menuItemNames: Map<string, string>;
  onEdit: (view: InventoryItemView) => void;
  onSetQuantity: (view: InventoryItemView, quantity: number) => void;
  onMarkOutOfStock: (view: InventoryItemView) => void;
  onRestore: (view: InventoryItemView) => void;
  onDelete: (view: InventoryItemView) => void;
}

export function InventoryList({
  items,
  busyId,
  menuItemNames,
  onEdit,
  onSetQuantity,
  onMarkOutOfStock,
  onRestore,
  onDelete,
}: InventoryListProps) {
  const [confirming, setConfirming] = useState<{
    id: string;
    action: 'delete' | 'out-of-stock';
  } | null>(null);

  return (
    <ul className={styles.list}>
      {items.map((view) => {
        const { record, status } = view;
        const busy = busyId === record.id;
        const linkedName = record.menuItemId
          ? menuItemNames.get(record.menuItemId)
          : undefined;
        const isConfirming = confirming?.id === record.id;

        return (
          <li
            key={record.id}
            className={`${styles.row} ${
              view.blocksSale ? styles.rowMuted : ''
            }`}
          >
            <div className={styles.main}>
              <div className={styles.titleRow}>
                <span className={styles.name}>{record.name}</span>
                <span
                  className={`${styles.status} ${styles[STATUS_CLASS[status]]}`}
                >
                  {STATUS_LABEL[status]}
                </span>
              </div>

              <div className={styles.metaRow}>
                <span className={styles.unit}>
                  {formatQuantity(record.quantity)} {record.unit}
                </span>
                {record.sku ? (
                  <span className={styles.sku}>{record.sku}</span>
                ) : null}
                {linkedName ? (
                  <span className={styles.linked}>
                    <LinkIcon width={13} height={13} />
                    {linkedName}
                  </span>
                ) : null}
                {record.reorderLevel !== null ? (
                  <span className={styles.reorder}>
                    Alert at {formatQuantity(record.reorderLevel)}
                  </span>
                ) : null}
              </div>
            </div>

            {isConfirming ? (
              <div className={styles.confirm}>
                <span className={styles.confirmText}>
                  {confirming.action === 'delete'
                    ? 'Delete this item?'
                    : 'Mark out of stock?'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(null)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  variant={
                    confirming.action === 'delete' ? 'danger' : 'secondary'
                  }
                  size="sm"
                  onClick={() => {
                    const action = confirming.action;
                    setConfirming(null);
                    if (action === 'delete') onDelete(view);
                    else onMarkOutOfStock(view);
                  }}
                  disabled={busy}
                >
                  {confirming.action === 'delete' ? 'Delete' : 'Confirm'}
                </Button>
              </div>
            ) : (
              <div className={styles.actions}>
                <QuantityStepper
                  value={record.quantity}
                  label={record.name}
                  disabled={busy}
                  onChange={(next) => onSetQuantity(view, next)}
                />

                {record.isOutOfStock === 1 ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onRestore(view)}
                    disabled={busy}
                  >
                    Restore
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setConfirming({ id: record.id, action: 'out-of-stock' })
                    }
                    disabled={busy}
                  >
                    Mark out
                  </Button>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onEdit(view)}
                  disabled={busy}
                >
                  Edit
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label={`Delete ${record.name}`}
                  onClick={() =>
                    setConfirming({ id: record.id, action: 'delete' })
                  }
                  disabled={busy}
                >
                  <TrashIcon width={17} height={17} />
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
