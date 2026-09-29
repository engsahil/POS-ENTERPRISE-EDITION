import { ImageIcon } from '@/components/ui/Icons';
import { sizeBadgeLabel, type MenuItemWithPrices } from '@/services/menuService';
import { formatMoney } from '@/utils/currency';
import styles from './ItemGrid.module.css';

export interface ItemGridProps {
  items: MenuItemWithPrices[];
  onSelect: (entry: MenuItemWithPrices, size: string) => void;
}

/**
 * Sellable items.
 *
 * Each priced variant is its own button, so choosing a size or volume and
 * adding to the cart is a single tap — the fastest path for a cashier.
 * The size list comes from the item's priced labels, so predefined and
 * custom volumes behave identically.
 */
export function ItemGrid({ items, onSelect }: ItemGridProps) {
  return (
    <ul className={styles.grid}>
      {items.map((entry) => {
        const sizes = entry.availableSizes;

        return (
          <li key={entry.item.id} className={styles.tile}>
            <div className={styles.thumb}>
              {entry.item.image ? (
                <img
                  src={entry.item.image.dataUrl}
                  alt=""
                  className={styles.thumbImage}
                />
              ) : (
                <span className={styles.thumbEmpty} aria-hidden="true">
                  <ImageIcon width={20} height={20} />
                </span>
              )}
            </div>

            <div className={styles.body}>
              <span className={styles.name}>{entry.item.name}</span>
              {entry.item.category ? (
                <span className={styles.category}>{entry.item.category}</span>
              ) : null}

              {sizes.length > 0 ? (
                <div className={styles.sizes}>
                  {sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={styles.sizeButton}
                      onClick={() => onSelect(entry, size)}
                      aria-label={`Add ${entry.item.name}, ${size}, ${formatMoney(
                        entry.prices[size] as number,
                      )}`}
                    >
                      <span className={styles.sizeLabel}>
                        {sizeBadgeLabel(size)}
                      </span>
                      <span className={styles.sizePrice}>
                        {formatMoney(entry.prices[size] as number)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <span className={styles.noPrice}>No price set</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
