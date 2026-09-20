import { useState } from 'react';
import { ImageField } from '@/components/admin/ImageField';
import { PriceInput } from '@/components/admin/PriceInput';
import { Button, Input, Textarea } from '@/components/ui';
import { useMenu } from '@/hooks/useMenu';
import {
  EMPTY_DEAL,
  dealService,
  priceDeal,
  type DealInput,
  type DealView,
} from '@/services/dealService';
import { CURRENCY } from '@/config/app.config';
import type { DealLine, DealPricingType } from '@/types/domain';
import { ITEM_IMAGE_MAX_EDGE } from '@/utils/image';
import { formatMoney } from '@/utils/currency';
import { DealProductPicker } from './DealProductPicker';
import styles from './DealForm.module.css';

type Errors = { name?: string; items?: string; price?: string };

export interface DealFormProps {
  editing?: DealView;
  onDone: () => void;
  onCancel: () => void;
}

function toInput(view: DealView): DealInput {
  return {
    name: view.record.name,
    description: view.record.description ?? '',
    image: view.record.image ?? null,
    pricingType: view.record.pricingType,
    price: view.record.price,
    percentOff: view.record.percentOff,
    items: view.record.items.map((l) => ({ ...l })),
    isPublished: view.record.isPublished === 1,
  };
}

export function DealForm({ editing, onDone, onCancel }: DealFormProps) {
  const { items: menuItems } = useMenu();
  const [values, setValues] = useState<DealInput>(() =>
    editing ? toInput(editing) : { ...EMPTY_DEAL, items: [] },
  );
  const [percentText, setPercentText] = useState(
    editing?.record.percentOff != null ? String(editing.record.percentOff) : '',
  );
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  function setField<K extends keyof DealInput>(key: K, value: DealInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors({});
  }

  // Live preview of what the customer would pay, using current menu prices.
  const preview = priceDeal(
    {
      id: 'preview',
      name: values.name,
      description: values.description,
      image: values.image,
      pricingType: values.pricingType,
      price: values.price,
      percentOff: values.percentOff,
      items: values.items,
      isPublished: values.isPublished ? 1 : 0,
      createdAt: '',
      updatedAt: '',
      deletedAt: null,
      rev: 1,
    },
    new Map(menuItems.map((e) => [e.item.id, e])),
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const found: Errors = {};
    if (!values.name.trim()) found.name = 'Deal name is required.';
    if (values.items.length === 0) {
      found.items = 'Add at least one product to the deal.';
    }
    if (values.pricingType === 'fixed') {
      if (values.price === null) found.price = 'Deal price is required.';
      else if (values.price < 0) found.price = 'Price cannot be negative.';
    } else {
      const p = values.percentOff;
      if (p === null) found.price = 'Discount percentage is required.';
      else if (p <= 0 || p > 100) {
        found.price = 'Enter a percentage between 1 and 100.';
      }
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    setFailure(null);
    try {
      if (editing) await dealService.update(editing.record.id, values);
      else await dealService.create(values);
      onDone();
    } catch {
      setFailure('Could not save the deal. Please try again.');
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.card}>
        <div className={styles.group}>
          <Input
            label="Deal name"
            name="dealName"
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            invalid={Boolean(errors.name)}
            hint={errors.name}
            autoComplete="off"
            autoFocus
            fullWidth
          />

          <Textarea
            label="Description"
            name="dealDescription"
            value={values.description}
            onChange={(e) => setField('description', e.target.value)}
            rows={2}
            fullWidth
          />

          <ImageField
            value={values.image}
            onChange={(image) => setField('image', image)}
            disabled={saving}
            label="Deal image"
            idPrefix="deal-image"
            maxEdge={ITEM_IMAGE_MAX_EDGE}
            uploadLabel="Upload image"
            emptyHint="Optional. PNG, JPG, WebP or SVG, compressed automatically."
          />
        </div>

        <div className={styles.divider} />

        <DealProductPicker
          menuItems={menuItems}
          value={values.items}
          disabled={saving}
          onChange={(items: DealLine[]) => setField('items', items)}
        />
        {errors.items ? (
          <p className={styles.error} role="alert">
            {errors.items}
          </p>
        ) : null}

        <div className={styles.divider} />

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Pricing</legend>

          <div className={styles.radios}>
            {(
              [
                ['fixed', `Fixed bundle price (${CURRENCY.symbol})`],
                ['percentage', 'Percentage off'],
              ] as [DealPricingType, string][]
            ).map(([type, label]) => (
              <label key={type} className={styles.radio}>
                <input
                  type="radio"
                  name="dealPricingType"
                  value={type}
                  className={styles.radioInput}
                  checked={values.pricingType === type}
                  onChange={() => setField('pricingType', type)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {values.pricingType === 'fixed' ? (
            <PriceInput
              label={`Deal price (${CURRENCY.symbol})`}
              name="dealPrice"
              value={values.price}
              onChange={(price) => setField('price', price)}
              invalid={Boolean(errors.price)}
              hint={errors.price}
              disabled={saving}
            />
          ) : (
            <Input
              label="Discount (%)"
              name="dealPercent"
              value={percentText}
              onChange={(e) => {
                const next = e.target.value;
                if (next !== '' && !/^\d{0,3}(\.\d{0,2})?$/.test(next)) return;
                setPercentText(next);
                setField(
                  'percentOff',
                  next.trim() === '' ? null : Number(next),
                );
              }}
              invalid={Boolean(errors.price)}
              hint={errors.price}
              inputMode="decimal"
              autoComplete="off"
              fullWidth
            />
          )}

          {values.items.length > 0 ? (
            <dl className={styles.preview}>
              <div className={styles.previewRow}>
                <dt>Items total</dt>
                <dd>{formatMoney(preview.itemsTotal)}</dd>
              </div>
              <div className={styles.previewRow}>
                <dt>Deal price</dt>
                <dd className={styles.previewPrice}>
                  {formatMoney(preview.dealPrice)}
                </dd>
              </div>
              <div className={styles.previewRow}>
                <dt>Customer saves</dt>
                <dd className={styles.previewSaving}>
                  {formatMoney(preview.savings)}
                </dd>
              </div>
            </dl>
          ) : null}
        </fieldset>

        <div className={styles.divider} />

        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            name="dealPublished"
            className={styles.checkbox}
            checked={values.isPublished}
            onChange={(e) => setField('isPublished', e.target.checked)}
          />
          <span>
            <span className={styles.toggleLabel}>Published</span>
            <span className={styles.toggleHint}>
              Published deals appear in the POS. Unpublished deals stay saved
              and editable.
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
          {saving ? 'Saving' : editing ? 'Save changes' : 'Create deal'}
        </Button>
      </div>
    </form>
  );
}
