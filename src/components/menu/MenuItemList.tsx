import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { ImageIcon, TrashIcon } from '@/components/ui/Icons';
import {
  sizeBadgeLabel,
  type MenuItemWithPrices,
} from '@/services/menuService';
import { formatMoney } from '@/utils/currency';
import styles from './MenuItemList.module.css';

export interface MenuItemListProps {
  items: MenuItemWithPrices[];
  onEdit: (entry: MenuItemWithPrices) => void;
  onToggleActive: (entry: MenuItemWithPrices, active: boolean) => void;
  onDelete: (entry: MenuItemWithPrices) => void;
  busyId?: string | null;
}

interface AvailabilitySwitchProps {
  active: boolean;
  label: string;
  disabled?: boolean;
  onChange: (active: boolean) => void;
}

/**
 * Availability toggle.
 *
 * Renders an optimistic value so the switch responds instantly, then falls
 * back in step with the persisted record once the write completes.
 */
function AvailabilitySwitch({
  active,
  label,
  disabled,
  onChange,
}: AvailabilitySwitchProps) {
  const [optimistic, setOptimistic] = useState(active);

  useEffect(() => {
    setOptimistic(active);
  }, [active]);

  return (
    <span className={styles.switch}>
      <input
        type="checkbox"
        className={styles.switchInput}
        checked={optimistic}
        disabled={disabled}
        onChange={(e) => {
          setOptimistic(e.target.checked);
          onChange(e.target.checked);
        }}
        aria-label={`${label} available for sale`}
      />
      <span className={styles.switchTrack} aria-hidden="true">
        <span className={styles.switchThumb} />
      </span>
    </span>
  );
}

export function MenuItemList({
  items,
  onEdit,
  onToggleActive,
  onDelete,
  busyId,
}: MenuItemListProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <ul className={styles.list}>
      {items.map((entry) => {
        const { item } = entry;
        const disabled = item.isActive === 0;
        const confirming = confirmingId === item.id;
        const busy = busyId === item.id;

        return (
          <li
            key={item.id}
            className={`${styles.row} ${disabled ? styles.rowDisabled : ''}`}
          >
            <div className={styles.thumb}>
              {item.image ? (
                <img
                  src={item.image.dataUrl}
                  alt=""
                  className={styles.thumbImage}
                />
              ) : (
                <span className={styles.thumbEmpty} aria-hidden="true">
                  <ImageIcon width={18} height={18} />
                </span>
              )}
            </div>

            <div className={styles.main}>
              <div className={styles.titleRow}>
                <span className={styles.name}>{item.name}</span>
                {disabled ? (
                  <span className={styles.badge}>Disabled</span>
                ) : null}
                {item.discountPercent ? (
                  <span className={styles.badge}>
                    {item.discountPercent}% off
                  </span>
                ) : null}
              </div>

              <div className={styles.metaRow}>
                {item.category ? (
                  <span className={styles.category}>{item.category}</span>
                ) : null}

                {entry.availableSizes.length > 0 ? (
                  <span className={styles.prices}>
                    {entry.availableSizes.map((s) => (
                      <span key={s} className={styles.price}>
                        <span className={styles.priceSize}>
                          {sizeBadgeLabel(s)}
                        </span>
                        {formatMoney(entry.prices[s] as number)}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className={styles.noPrice}>No price set</span>
                )}
              </div>
            </div>

            {confirming ? (
              <div className={styles.confirm}>
                <span className={styles.confirmText}>Delete this item?</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingId(null)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setConfirmingId(null);
                    onDelete(entry);
                  }}
                  disabled={busy}
                >
                  Delete
                </Button>
              </div>
            ) : (
              <div className={styles.actions}>
                <AvailabilitySwitch
                  active={item.isActive === 1}
                  label={item.name}
                  disabled={busy}
                  onChange={(active) => onToggleActive(entry, active)}
                />

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onEdit(entry)}
                  disabled={busy}
                >
                  Edit
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label={`Delete ${item.name}`}
                  onClick={() => setConfirmingId(item.id)}
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
