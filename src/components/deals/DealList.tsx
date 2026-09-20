import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { ImageIcon, TrashIcon } from '@/components/ui/Icons';
import type { DealView } from '@/services/dealService';
import { formatMoney } from '@/utils/currency';
import styles from './DealList.module.css';

interface PublishSwitchProps {
  published: boolean;
  label: string;
  disabled?: boolean;
  onChange: (published: boolean) => void;
}

/** Optimistic so the switch responds instantly during the DB round-trip. */
function PublishSwitch({
  published,
  label,
  disabled,
  onChange,
}: PublishSwitchProps) {
  const [optimistic, setOptimistic] = useState(published);

  useEffect(() => {
    setOptimistic(published);
  }, [published]);

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
        aria-label={`${label} published`}
      />
      <span className={styles.switchTrack} aria-hidden="true">
        <span className={styles.switchThumb} />
      </span>
    </span>
  );
}

export interface DealListProps {
  deals: DealView[];
  busyId?: string | null;
  onEdit: (view: DealView) => void;
  onTogglePublished: (view: DealView, published: boolean) => void;
  onDelete: (view: DealView) => void;
}

export function DealList({
  deals,
  busyId,
  onEdit,
  onTogglePublished,
  onDelete,
}: DealListProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <ul className={styles.list}>
      {deals.map((view) => {
        const { record } = view;
        const busy = busyId === record.id;
        const confirming = confirmingId === record.id;
        const unpublished = record.isPublished === 0;

        return (
          <li
            key={record.id}
            className={`${styles.row} ${unpublished ? styles.rowMuted : ''}`}
          >
            <div className={styles.thumb}>
              {record.image ? (
                <img
                  src={record.image.dataUrl}
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
                <span className={styles.name}>{record.name}</span>
                <span
                  className={`${styles.badge} ${
                    unpublished ? styles.badgeDraft : styles.badgeLive
                  }`}
                >
                  {unpublished ? 'Unpublished' : 'Published'}
                </span>
                {!view.isSellable ? (
                  <span className={`${styles.badge} ${styles.badgeWarn}`}>
                    Not sellable
                  </span>
                ) : null}
              </div>

              <div className={styles.metaRow}>
                <span className={styles.price}>
                  {formatMoney(view.dealPrice)}
                </span>
                {view.savings > 0 ? (
                  <span className={styles.was}>
                    was {formatMoney(view.itemsTotal)}
                  </span>
                ) : null}
                <span className={styles.count}>
                  {record.items.length} product
                  {record.items.length === 1 ? '' : 's'}
                </span>
                {record.pricingType === 'percentage' &&
                record.percentOff !== null ? (
                  <span className={styles.type}>{record.percentOff}% off</span>
                ) : null}
              </div>
            </div>

            {confirming ? (
              <div className={styles.confirm}>
                <span className={styles.confirmText}>Delete this deal?</span>
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
                    onDelete(view);
                  }}
                  disabled={busy}
                >
                  Delete
                </Button>
              </div>
            ) : (
              <div className={styles.actions}>
                <PublishSwitch
                  published={record.isPublished === 1}
                  label={record.name}
                  disabled={busy}
                  onChange={(next) => onTogglePublished(view, next)}
                />

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
                  onClick={() => setConfirmingId(record.id)}
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
