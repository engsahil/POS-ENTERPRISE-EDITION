import { useEffect, useState } from 'react';
import { Button, Input } from '@/components/ui';
import { useMenu } from '@/hooks/useMenu';
import {
  EMPTY_INVENTORY_INPUT,
  INVENTORY_UNITS,
  inventoryService,
  type InventoryInput,
  type InventoryItemView,
} from '@/services/inventoryService';
import { SETTING_KEYS, settingsService } from '@/services/settingsService';
import type { InventoryUnit } from '@/types/domain';
import styles from './InventoryForm.module.css';

type Errors = Partial<Record<'name' | 'quantity' | 'reorderLevel', string>>;

export interface InventoryFormProps {
  editing?: InventoryItemView;
  onDone: () => void;
  onCancel: () => void;
}

/** Empty string while the field is blank, so no fake zero is ever shown. */
type NumberText = string;

function toText(value: number | null): NumberText {
  return value === null ? '' : String(value);
}

/** Accepts digits with an optional decimal part, or empty. */
const NUMBER_PATTERN = /^\d*\.?\d{0,3}$/;

export function InventoryForm({
  editing,
  onDone,
  onCancel,
}: InventoryFormProps) {
  const { items: menuItems } = useMenu();

  const [name, setName] = useState(editing?.record.name ?? '');
  const [sku, setSku] = useState(editing?.record.sku ?? '');
  const [unit, setUnit] = useState<InventoryUnit>(
    editing?.record.unit ?? EMPTY_INVENTORY_INPUT.unit,
  );
  // Quantity starts blank on a new line rather than a made-up 0.
  const [quantity, setQuantity] = useState<NumberText>(
    editing ? String(editing.record.quantity) : '',
  );
  const [reorderLevel, setReorderLevel] = useState<NumberText>(
    editing ? toText(editing.record.reorderLevel) : '',
  );
  const [menuItemId, setMenuItemId] = useState<string>(
    editing?.record.menuItemId ?? '',
  );
  const [isAvailable, setIsAvailable] = useState(
    editing ? editing.record.isAvailable === 1 : true,
  );

  // Set once the operator touches the link select themselves; after that
  // the form never overrides their choice.
  const [linkTouched, setLinkTouched] = useState(false);

  const [linkedElsewhere, setLinkedElsewhere] = useState<Set<string>>(
    new Set(),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Pre-fill the low stock alert from the Admin default, for new lines only.
  useEffect(() => {
    if (editing) return;
    let active = true;
    void settingsService
      .get<number | null>(SETTING_KEYS.lowStockDefault, null)
      .then((value) => {
        if (!active || value === null) return;
        setReorderLevel((current) => (current === '' ? String(value) : current));
      });
    return () => {
      active = false;
    };
  }, [editing]);

  // A menu item may only be linked to one stock line.
  useEffect(() => {
    let active = true;
    void inventoryService
      .linkedMenuItemIds(editing?.record.id)
      .then((used) => {
        if (active) setLinkedElsewhere(used);
      });
    return () => {
      active = false;
    };
  }, [editing?.record.id]);

  const availableMenuItems = menuItems.filter(
    (entry) =>
      !linkedElsewhere.has(entry.item.id) || entry.item.id === menuItemId,
  );

  /*
   * Suggest the menu item with the exact same name as the stock line, so
   * "Cold Drink" in Inventory is linked to "Cold Drink" in the menu without
   * the operator having to discover the select. The suggestion is stored as
   * the real menuItemId (matching at sell time is always by ID, never by
   * name) and only fills an empty, untouched select — a manual choice,
   * including clearing the field, is never overridden.
   */
  useEffect(() => {
    if (linkTouched || menuItemId) return;
    const key = name.trim().toLowerCase();
    if (!key) return;
    const matches = availableMenuItems.filter(
      (entry) => entry.item.name.trim().toLowerCase() === key,
    );
    const match = matches[0];
    if (matches.length === 1 && match) setMenuItemId(match.item.id);
    // availableMenuItems is derived from its sources; those are the real
    // dependencies and re-running on derivation is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, menuItems, linkedElsewhere, menuItemId, linkTouched]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const found: Errors = {};
    if (!name.trim()) found.name = 'Item name is required.';

    const qty = quantity.trim() === '' ? null : Number(quantity);
    if (qty === null) {
      found.quantity = 'Quantity is required.';
    } else if (!Number.isFinite(qty) || qty < 0) {
      found.quantity = 'Quantity cannot be negative.';
    }

    const reorder = reorderLevel.trim() === '' ? null : Number(reorderLevel);
    if (reorder !== null && (!Number.isFinite(reorder) || reorder < 0)) {
      found.reorderLevel = 'Low stock alert cannot be negative.';
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const input: InventoryInput = {
      name,
      sku,
      unit,
      quantity: qty as number,
      reorderLevel: reorder,
      menuItemId: menuItemId || null,
      isAvailable,
    };

    setSaving(true);
    setFailure(null);
    try {
      if (editing) {
        await inventoryService.update(editing.record.id, input);
      } else {
        await inventoryService.create(input);
      }
      onDone();
    } catch {
      setFailure('Could not save this stock line. Please try again.');
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.card}>
        <div className={styles.group}>
          <Input
            label="Item name"
            name="stockName"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((p) => ({ ...p, name: undefined }));
            }}
            invalid={Boolean(errors.name)}
            hint={errors.name}
            autoComplete="off"
            autoFocus
            fullWidth
          />

          <div className={styles.pair}>
            <Input
              label="SKU or code"
              name="stockSku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              autoComplete="off"
              hint="Optional."
              fullWidth
            />

            <div className={styles.selectWrapper}>
              <label className={styles.label} htmlFor="stockUnit">
                Unit
              </label>
              <div className={styles.selectField}>
                <select
                  id="stockUnit"
                  name="stockUnit"
                  className={styles.select}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as InventoryUnit)}
                >
                  {INVENTORY_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className={styles.pair}>
            <Input
              label="Quantity"
              name="stockQuantity"
              value={quantity}
              onChange={(e) => {
                const next = e.target.value;
                if (next !== '' && !NUMBER_PATTERN.test(next)) return;
                setQuantity(next);
                setErrors((p) => ({ ...p, quantity: undefined }));
              }}
              invalid={Boolean(errors.quantity)}
              hint={errors.quantity}
              inputMode="decimal"
              autoComplete="off"
              fullWidth
            />

            <Input
              label="Low stock alert"
              name="stockReorder"
              value={reorderLevel}
              onChange={(e) => {
                const next = e.target.value;
                if (next !== '' && !NUMBER_PATTERN.test(next)) return;
                setReorderLevel(next);
                setErrors((p) => ({ ...p, reorderLevel: undefined }));
              }}
              invalid={Boolean(errors.reorderLevel)}
              hint={errors.reorderLevel ?? 'Optional. Warn at or below this.'}
              inputMode="decimal"
              autoComplete="off"
              fullWidth
            />
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.selectWrapper}>
          <label className={styles.label} htmlFor="stockMenuItem">
            Linked menu item
          </label>
          <div className={styles.selectField}>
            <select
              id="stockMenuItem"
              name="stockMenuItem"
              className={styles.select}
              value={menuItemId}
              onChange={(e) => {
                setLinkTouched(true);
                setMenuItemId(e.target.value);
              }}
            >
              <option value="">Not linked</option>
              {availableMenuItems.map((entry) => (
                <option key={entry.item.id} value={entry.item.id}>
                  {entry.item.name}
                </option>
              ))}
            </select>
          </div>
          <p className={styles.hint}>
            {menuItems.length === 0
              ? 'Add menu items first to link this stock line to one.'
              : 'Selling the linked menu item in the POS reduces this stock automatically; at zero, the item is hidden from the POS.'}
          </p>
        </div>

        <div className={styles.divider} />

        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            name="stockAvailable"
            className={styles.checkbox}
            checked={isAvailable}
            onChange={(e) => setIsAvailable(e.target.checked)}
          />
          <span>
            <span className={styles.toggleLabel}>Available</span>
            <span className={styles.toggleHint}>
              Turn off to withhold this item without changing its quantity.
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
