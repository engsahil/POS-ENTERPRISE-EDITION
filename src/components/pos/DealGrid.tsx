import { ImageIcon, TagIcon } from '@/components/ui/Icons';
import type { DealView } from '@/services/dealService';
import { formatMoney } from '@/utils/currency';
import styles from './DealGrid.module.css';

export interface DealGridProps {
  deals: DealView[];
  onSelect: (view: DealView) => void;
}

/** Published deals, shown above the individual items in the POS. */
export function DealGrid({ deals, onSelect }: DealGridProps) {
  return (
    <section>
      <h2 className={styles.heading}>Deals</h2>

      <ul className={styles.grid}>
        {deals.map((view) => (
          <li key={view.record.id}>
            <button
              type="button"
              className={styles.tile}
              onClick={() => onSelect(view)}
              aria-label={`Add deal ${view.record.name}, ${formatMoney(
                view.dealPrice,
              )}`}
            >
              <span className={styles.thumb}>
                {view.record.image ? (
                  <img
                    src={view.record.image.dataUrl}
                    alt=""
                    className={styles.thumbImage}
                  />
                ) : (
                  <span className={styles.thumbEmpty} aria-hidden="true">
                    <ImageIcon width={20} height={20} />
                  </span>
                )}
                <span className={styles.ribbon} aria-hidden="true">
                  <TagIcon width={13} height={13} />
                  Deal
                </span>
              </span>

              <span className={styles.body}>
                <span className={styles.name}>{view.record.name}</span>

                {view.record.description ? (
                  <span className={styles.description}>
                    {view.record.description}
                  </span>
                ) : null}

                <span className={styles.priceRow}>
                  <span className={styles.price}>
                    {formatMoney(view.dealPrice)}
                  </span>
                  {view.savings > 0 ? (
                    <span className={styles.was}>
                      {formatMoney(view.itemsTotal)}
                    </span>
                  ) : null}
                </span>

                {view.savings > 0 ? (
                  <span className={styles.saving}>
                    Save {formatMoney(view.savings)}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
