import { useEffect, useState } from 'react';
import { ImageField } from '@/components/admin/ImageField';
import { PriceInput } from '@/components/admin/PriceInput';
import { Button, Input, Textarea } from '@/components/ui';
import {
  EMPTY_MENU_ITEM,
  menuService,
  SIZES,
  type MenuItemInput,
  type MenuItemWithPrices,
  type SizeLabel,
} from '@/services/menuService';
import { CURRENCY } from '@/config/app.config';
import type { Paisa } from '@/types/common';
import { ITEM_IMAGE_MAX_EDGE } from '@/utils/image';
import styles from './MenuItemForm.module.css';

type Errors = { name?: string; prices?: string };

export interface MenuItemFormProps {
  /** Existing item to edit, or undefined to add a new one. */
  editing?: MenuItemWithPrices;
  onDone: () => void;
  onCancel: () => void;
}

function toInput(entry: MenuItemWithPrices): MenuItemInput {
  return {
    name: entry.item.name,
    category: entry.item.category ?? '',
    description: entry.item.description ?? '',
    image: entry.item.image ?? null,
    isActive: entry.item.isActive === 1,
    prices: { ...entry.prices },
  };
}

export function MenuItemForm({ editing, onDone, onCancel }: MenuItemFormProps) {
  const [values, setValues] = useState<MenuItemInput>(() =>
    editing ? toInput(editing) : { ...EMPTY_MENU_ITEM },
  );
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void menuService.categories().then((list) => {
      if (active) setCategories(list);
    });
    return () => {
      active = false;
    };
  }, []);

  function setField<K extends keyof MenuItemInput>(
    key: K,
    value: MenuItemInput[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key === 'prices' ? 'prices' : 'name']: undefined }));
  }

  function setPrice(size: SizeLabel, price: Paisa | null) {
    setValues((prev) => ({ ...prev, prices: { ...prev.prices, [size]: price } }));
    setErrors((prev) => ({ ...prev, prices: undefined }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const found: Errors = {};
    if (!values.name.trim()) found.name = 'Item name is required.';

    const negative = SIZES.some((s) => {
      const v = values.prices[s];
      return v !== null && v < 0;
    });
    if (negative) found.prices = 'Prices cannot be negative.';

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    setFailure(null);
    try {
      if (editing) {
        await menuService.update(editing.item.id, values);
      } else {
        await menuService.create(values);
      }
      onDone();
    } catch {
      setFailure('Could not save the item. Please try again.');
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.card}>
        <div className={styles.group}>
          <Input
            label="Item name"
            name="itemName"
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            invalid={Boolean(errors.name)}
            hint={errors.name}
            autoComplete="off"
            autoFocus
            fullWidth
          />

          <Input
            label="Category"
            name="itemCategory"
            value={values.category}
            onChange={(e) => setField('category', e.target.value)}
            list="menu-categories"
            autoComplete="off"
            hint="Used to group items in the POS."
            fullWidth
          />
          {/* Suggestions come only from categories the user already created. */}
          <datalist id="menu-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <Textarea
            label="Description"
            name="itemDescription"
            value={values.description}
            onChange={(e) => setField('description', e.target.value)}
            rows={2}
            fullWidth
          />

          <ImageField
            value={values.image}
            onChange={(image) => setField('image', image)}
            disabled={saving}
            label="Item image"
            idPrefix="item-image"
            maxEdge={ITEM_IMAGE_MAX_EDGE}
            uploadLabel="Upload image"
          />
        </div>

        <div className={styles.divider} />

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>
            Prices ({CURRENCY.symbol})
          </legend>
          <p className={styles.legendHint}>
            Leave a size empty if the item is not sold in that size.
          </p>

          <div className={styles.prices}>
            {SIZES.map((size) => (
              <PriceInput
                key={size}
                label={size}
                name={`price${size}`}
                value={values.prices[size]}
                onChange={(price) => setPrice(size, price)}
                disabled={saving}
              />
            ))}
          </div>

          {errors.prices ? (
            <p className={styles.error} role="alert">
              {errors.prices}
            </p>
          ) : null}
        </fieldset>

        <div className={styles.divider} />

        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            name="itemActive"
            className={styles.checkbox}
            checked={values.isActive}
            onChange={(e) => setField('isActive', e.target.checked)}
          />
          <span>
            <span className={styles.toggleLabel}>Available for sale</span>
            <span className={styles.toggleHint}>
              Disabled items stay saved but are hidden from the POS.
            </span>
          </span>
        </label>
      </div>

      {failure ? (
        <p className={styles.failure} role="alert">
          {failure}
        </p>
      ) : null}

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving' : editing ? 'Save changes' : 'Add item'}
        </Button>
      </div>
    </form>
  );
}
