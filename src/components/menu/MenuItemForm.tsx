import { useEffect, useState } from 'react';
import { ImageField } from '@/components/admin/ImageField';
import { PriceInput } from '@/components/admin/PriceInput';
import { Button, Input, Textarea } from '@/components/ui';
import {
  EMPTY_MENU_ITEM,
  menuService,
  labelsForKind,
  type MenuItemInput,
  type MenuItemWithPrices,
  type SizePrices,
  type VariantKind,
} from '@/services/menuService';
import { CURRENCY } from '@/config/app.config';
import { formatMoney } from '@/utils/currency';
import type { Paisa } from '@/types/common';
import { ITEM_IMAGE_MAX_EDGE } from '@/utils/image';
import styles from './MenuItemForm.module.css';

type Errors = { name?: string; prices?: string; discount?: string };

export interface MenuItemFormProps {
  /** Existing item to edit, or undefined to add a new one. */
  editing?: MenuItemWithPrices;
  onDone: () => void;
  onCancel: () => void;
}

/**
 * One volume row being edited: label stored verbatim ("350 ml", "2 Liter",
 * or a legacy label such as "500 ml / Half Liter") with its price.
 */
interface VolumeRow {
  label: string;
  price: Paisa;
}

/** Draft values for the "add a volume" row. */
interface VolumeDraft {
  value: string;
  unit: 'ml' | 'L';
  price: Paisa | null;
}

const EMPTY_VOLUME_DRAFT: VolumeDraft = { value: '', unit: 'ml', price: null };

/** Volumes above this are nonsense; it also keeps labels out of exponent form. */
const MAX_VOLUME = 1_000_000;

/**
 * Split a stored volume label such as "350 ml", "2 Liter" or the legacy
 * "500 ml / Half Liter" into its numeric value and unit. Returns null for
 * labels that are not numeric volumes (e.g. food sizes).
 */
function parseVolumeLabel(label: string): { value: string; unit: 'ml' | 'L' } | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(ml|liters?|litres?|lt|l)\b/i.exec(label);
  if (!match) return null;
  const value = match[1] ?? '';
  const unitText = (match[2] ?? '').toLowerCase();
  if (!value || !unitText) return null;
  return { value, unit: unitText === 'ml' ? 'ml' : 'L' };
}

/** Canonical label for a numeric volume: "350 ml", "2 Liter". */
function formatVolumeLabel(value: number, unit: 'ml' | 'L'): string {
  const numeric = String(value);
  return unit === 'ml' ? `${numeric} ml` : `${numeric} Liter`;
}

/** Volume rows for an item's priced labels, in stored order. */
function rowsFromPrices(prices: SizePrices): VolumeRow[] {
  const rows: VolumeRow[] = [];
  for (const [label, price] of Object.entries(prices)) {
    if (price === null) continue;
    if (!parseVolumeLabel(label)) continue;
    rows.push({ label, price });
  }
  return rows;
}

/** Prices object built from the edited rows — the only volume labels saved. */
function pricesFromRows(rows: VolumeRow[]): SizePrices {
  const prices: SizePrices = {};
  for (const row of rows) prices[row.label] = row.price;
  return prices;
}

function initialValues(editing?: MenuItemWithPrices): MenuItemInput {
  return editing ? toInput(editing) : { ...EMPTY_MENU_ITEM };
}

function toInput(entry: MenuItemWithPrices): MenuItemInput {
  return {
    name: entry.item.name,
    category: entry.item.category ?? '',
    description: entry.item.description ?? '',
    image: entry.item.image ?? null,
    isActive: entry.item.isActive === 1,
    variantKind: entry.item.variantKind === 'volume' ? 'volume' : 'size',
    // Includes the item's custom volume keys — the service filters labels
    // to the active kind on save, so nothing needs nulling here.
    prices: { ...entry.prices },
  };
}

export function MenuItemForm({ editing, onDone, onCancel }: MenuItemFormProps) {
  const [values, setValues] = useState<MenuItemInput>(() =>
    initialValues(editing),
  );
  // Volume rows are the editing state for cold drink volumes; they are
  // converted to plain price labels only when the form is submitted.
  const [volumeRows, setVolumeRows] = useState<VolumeRow[]>(() => {
    const initial = initialValues(editing);
    return initial.variantKind === 'volume'
      ? rowsFromPrices(initial.prices)
      : [];
  });
  const [volumeDraft, setVolumeDraft] = useState<VolumeDraft>(
    EMPTY_VOLUME_DRAFT,
  );
  const [volumeError, setVolumeError] = useState<string | null>(null);
  // Kept as text so partial input like "12." stays editable while typing.
  const [discountText, setDiscountText] = useState(
    () =>
      editing?.item.discountPercent != null
        ? String(editing.item.discountPercent)
        : '',
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

  function setPrice(size: string, price: Paisa | null) {
    setValues((prev) => ({ ...prev, prices: { ...prev.prices, [size]: price } }));
    setErrors((prev) => ({ ...prev, prices: undefined }));
  }

  /**
   * Switch between food sizes and cold drink volumes. The grids are
   * independent: volume rows are kept in their own state and sizes stay in
   * `values.prices`, so toggling back and forth without saving loses
   * nothing. On save, the service clears whichever set is not active.
   */
  function setVariantKind(kind: VariantKind) {
    setValues((prev) =>
      prev.variantKind === kind ? prev : { ...prev, variantKind: kind },
    );
    setErrors((prev) => ({ ...prev, prices: undefined }));
    setVolumeError(null);
  }

  function addVolumeRow() {
    const text = volumeDraft.value.trim();
    const numeric = Number(text);
    if (!text || !Number.isFinite(numeric) || numeric <= 0 || numeric > MAX_VOLUME) {
      setVolumeError('Enter a volume greater than 0, for example 350.');
      return;
    }
    if (volumeDraft.price === null) {
      setVolumeError('Enter a price for this volume.');
      return;
    }
    const label = formatVolumeLabel(numeric, volumeDraft.unit);
    if (volumeRows.some((row) => row.label === label)) {
      setVolumeError('That volume is already listed.');
      return;
    }
    setVolumeRows((prev) => [...prev, { label, price: volumeDraft.price as Paisa }]);
    setVolumeDraft((prev) => ({ ...EMPTY_VOLUME_DRAFT, unit: prev.unit }));
    setVolumeError(null);
  }

  function removeVolumeRow(label: string) {
    setVolumeRows((prev) => prev.filter((row) => row.label !== label));
    setVolumeError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const found: Errors = {};
    if (!values.name.trim()) found.name = 'Item name is required.';

    const prices: SizePrices =
      values.variantKind === 'volume'
        ? pricesFromRows(volumeRows)
        : values.prices;
    const negative = Object.values(prices).some(
      (v) => v !== null && v < 0,
    );
    if (negative) found.prices = 'Prices cannot be negative.';

    // Item-level discount: empty means none; anything entered must be a
    // percentage between 0 and 100.
    let discountPercent: number | null = null;
    const discountRaw = discountText.trim();
    if (discountRaw) {
      const parsed = Number(discountRaw);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        found.discount = 'Enter a percentage between 0 and 100.';
      } else {
        discountPercent = parsed === 0 ? null : Math.round(parsed * 100) / 100;
      }
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    setFailure(null);
    try {
      const payload: MenuItemInput = { ...values, prices, discountPercent };
      if (editing) {
        await menuService.update(editing.item.id, payload);
      } else {
        await menuService.create(payload);
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

          <Input
            label="Discount (%)"
            name="itemDiscount"
            value={discountText}
            onChange={(e) => {
              setDiscountText(e.target.value);
              setErrors((prev) => ({ ...prev, discount: undefined }));
            }}
            inputMode="decimal"
            autoComplete="off"
            placeholder="None"
            hint={
              errors.discount ??
              'Applies to this item only at checkout. Leave empty for no discount.'
            }
            invalid={Boolean(errors.discount)}
            disabled={saving}
            fullWidth
          />

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

          <div className={styles.kinds} role="radiogroup" aria-label="Sold as">
            <label className={styles.kind}>
              <input
                type="radio"
                name="itemVariantKind"
                className={styles.kindInput}
                checked={values.variantKind === 'size'}
                onChange={() => setVariantKind('size')}
                disabled={saving}
              />
              <span>Food sizes</span>
            </label>
            <label className={styles.kind}>
              <input
                type="radio"
                name="itemVariantKind"
                className={styles.kindInput}
                checked={values.variantKind === 'volume'}
                onChange={() => setVariantKind('volume')}
                disabled={saving}
              />
              <span>Cold drink volume</span>
            </label>
          </div>

          <p className={styles.legendHint}>
            {values.variantKind === 'volume'
              ? 'For cold drinks and beverages. Enter any volume — for example 350 ml or 2 Liter — and its price.'
              : 'Leave a size empty if the item is not sold in that size.'}
          </p>

          {values.variantKind === 'volume' ? (
            <div className={styles.volumeBlock}>
              <div className={styles.volumeRows}>
                {volumeRows.length === 0 ? (
                  <p className={styles.volumeHint}>
                    No volumes yet. Add one below.
                  </p>
                ) : (
                  volumeRows.map((row) => (
                    <div key={row.label} className={styles.volumeRow}>
                      <span className={styles.volumeLabel}>{row.label}</span>
                      <span className={styles.volumePrice}>
                        {formatMoney(row.price)}
                      </span>
                      <button
                        type="button"
                        className={styles.volumeRemove}
                        aria-label={`Remove ${row.label}`}
                        onClick={() => removeVolumeRow(row.label)}
                        disabled={saving}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className={styles.volumeDraft}>
                <Input
                  label="Volume"
                  name="volumeValue"
                  value={volumeDraft.value}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next !== '' && !/^\d*\.?\d{0,3}$/.test(next)) return;
                    setVolumeDraft((prev) => ({ ...prev, value: next }));
                    setVolumeError(null);
                  }}
                  placeholder="350"
                  inputMode="decimal"
                  autoComplete="off"
                  disabled={saving}
                />
                <label className={styles.volumeUnit}>
                  <span className={styles.volumeUnitLabel}>Unit</span>
                  <select
                    className={styles.volumeSelect}
                    value={volumeDraft.unit}
                    onChange={(e) =>
                      setVolumeDraft((prev) => ({
                        ...prev,
                        unit: e.target.value === 'L' ? 'L' : 'ml',
                      }))
                    }
                    disabled={saving}
                  >
                    <option value="ml">ml</option>
                    <option value="L">L</option>
                  </select>
                </label>
                <PriceInput
                  label="Price"
                  name="volumePrice"
                  value={volumeDraft.price}
                  onChange={(price) => {
                    setVolumeDraft((prev) => ({ ...prev, price }));
                    setVolumeError(null);
                  }}
                  disabled={saving}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addVolumeRow}
                  disabled={saving}
                >
                  Add volume
                </Button>
              </div>

              {volumeError ? (
                <p className={styles.error} role="alert">
                  {volumeError}
                </p>
              ) : null}
            </div>
          ) : (
            <div className={styles.prices}>
              {labelsForKind(values.variantKind).map((size) => (
                <PriceInput
                  key={size}
                  label={size}
                  name={`price-${size.replace(/[^a-z0-9]+/gi, '-')}`}
                  value={values.prices[size] ?? null}
                  onChange={(price) => setPrice(size, price)}
                  disabled={saving}
                />
              ))}
            </div>
          )}

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
