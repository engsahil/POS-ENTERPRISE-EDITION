import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input, Textarea } from '@/components/ui';
import { CheckIcon, MailIcon, PhoneIcon } from '@/components/ui/Icons';
import {
  EMPTY_RESTAURANT_PROFILE,
  restaurantService,
  type RestaurantProfileInput,
} from '@/services/restaurantService';
import { LogoField } from './LogoField';
import styles from './RestaurantProfileForm.module.css';

type Errors = Partial<Record<keyof RestaurantProfileInput, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: RestaurantProfileInput): Errors {
  const errors: Errors = {};

  if (!values.name.trim()) {
    errors.name = 'Restaurant name is required.';
  }
  if (values.email.trim() && !EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (values.phone.trim() && values.phone.trim().length < 6) {
    errors.phone = 'Enter a valid phone number.';
  }
  if (
    !Number.isFinite(values.taxPercent) ||
    values.taxPercent < 0 ||
    values.taxPercent > 100
  ) {
    errors.taxPercent = 'Enter a tax rate between 0 and 100.';
  }

  return errors;
}

function isEqual(a: RestaurantProfileInput, b: RestaurantProfileInput): boolean {
  return (
    a.taxPercent === b.taxPercent &&
    a.taxInclusive === b.taxInclusive &&
    a.name === b.name &&
    a.address === b.address &&
    a.phone === b.phone &&
    a.email === b.email &&
    a.receiptInfo === b.receiptInfo &&
    a.receiptFooter === b.receiptFooter &&
    (a.logo?.dataUrl ?? null) === (b.logo?.dataUrl ?? null)
  );
}

export interface RestaurantProfileFormProps {
  /** Notifies the parent after a successful save. */
  onSaved?: () => void;
}

export function RestaurantProfileForm({ onSaved }: RestaurantProfileFormProps) {
  // `saved` is the last persisted state; `values` is what is on screen.
  const [saved, setSaved] = useState<RestaurantProfileInput>(
    EMPTY_RESTAURANT_PROFILE,
  );
  const [values, setValues] = useState<RestaurantProfileInput>(
    EMPTY_RESTAURANT_PROFILE,
  );
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  // Separate text state so a partially typed rate like "1." stays editable.
  const [taxText, setTaxText] = useState('0');
  const [failure, setFailure] = useState<string | null>(null);
  const confirmTimer = useRef<number | undefined>(undefined);

  // Load the actual saved record so editing always starts from real data.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const profile = await restaurantService.getProfile();
        if (!active) return;
        setSaved(profile);
        setValues(profile);
        setTaxText(String(profile.taxPercent));
      } catch {
        if (active) setFailure('Could not load the saved profile.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    },
    [],
  );

  const setField = useCallback(
    <K extends keyof RestaurantProfileInput>(
      key: K,
      value: RestaurantProfileInput[K],
    ) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
      setConfirmation(null);
    },
    [],
  );

  const dirty = !isEqual(values, saved);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    setFailure(null);
    try {
      await restaurantService.save(values);
      // Re-read from the database so the form reflects what was truly stored.
      const stored = await restaurantService.getProfile();
      setSaved(stored);
      setValues(stored);
      setTaxText(String(stored.taxPercent));
      setConfirmation('Profile saved.');
      onSaved?.();

      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
      confirmTimer.current = window.setTimeout(
        () => setConfirmation(null),
        4000,
      );
    } catch {
      setFailure('Could not save the profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className={styles.loading}>Loading profile…</p>;
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.card}>
        <div className={styles.group}>
          <Input
            label="Restaurant name"
            name="name"
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            invalid={Boolean(errors.name)}
            hint={errors.name}
            autoComplete="organization"
            fullWidth
          />

          <LogoField
            value={values.logo}
            onChange={(logo) => setField('logo', logo)}
            disabled={saving}
          />
        </div>

        <div className={styles.divider} />

        <div className={styles.group}>
          <Textarea
            label="Address"
            name="address"
            value={values.address}
            onChange={(e) => setField('address', e.target.value)}
            rows={2}
            autoComplete="street-address"
            fullWidth
          />

          <div className={styles.pair}>
            <Input
              label="Phone"
              name="phone"
              type="tel"
              inputMode="tel"
              value={values.phone}
              onChange={(e) => setField('phone', e.target.value)}
              invalid={Boolean(errors.phone)}
              hint={errors.phone}
              leadingIcon={<PhoneIcon />}
              autoComplete="tel"
              fullWidth
            />
            <Input
              label="Email"
              name="email"
              type="email"
              inputMode="email"
              value={values.email}
              onChange={(e) => setField('email', e.target.value)}
              invalid={Boolean(errors.email)}
              hint={errors.email}
              leadingIcon={<MailIcon />}
              autoComplete="email"
              fullWidth
            />
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.group}>
          <Textarea
            label="Receipt information"
            name="receiptInfo"
            value={values.receiptInfo}
            onChange={(e) => setField('receiptInfo', e.target.value)}
            rows={3}
            hint="Printed near the top of every receipt, under the restaurant details."
            fullWidth
          />

          <Textarea
            label="Receipt footer message"
            name="receiptFooter"
            value={values.receiptFooter}
            onChange={(e) => setField('receiptFooter', e.target.value)}
            rows={2}
            hint="Printed at the bottom of every receipt."
            fullWidth
          />
        </div>

        <div className={styles.divider} />

        <div className={styles.group}>
          <div className={styles.pair}>
            <Input
              label="Sales tax (%)"
              name="taxPercent"
              value={taxText}
              onChange={(e) => {
                const next = e.target.value;
                if (next !== '' && !/^\d{0,3}(\.\d{0,2})?$/.test(next)) return;
                setTaxText(next);
                setField('taxPercent', next.trim() === '' ? 0 : Number(next));
              }}
              onBlur={() => setTaxText(String(values.taxPercent))}
              invalid={Boolean(errors.taxPercent)}
              hint={
                errors.taxPercent ??
                'Applied to every order. Leave at 0 for no tax.'
              }
              inputMode="decimal"
              autoComplete="off"
              fullWidth
            />

            <label className={styles.checkRow}>
              <input
                type="checkbox"
                name="taxInclusive"
                className={styles.checkbox}
                checked={values.taxInclusive}
                onChange={(e) => setField('taxInclusive', e.target.checked)}
              />
              <span>
                <span className={styles.checkLabel}>
                  Prices include tax
                </span>
                <span className={styles.checkHint}>
                  Tax is extracted from the price instead of added on top.
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {failure ? (
        <p className={styles.failure} role="alert">
          {failure}
        </p>
      ) : null}

      <div className={styles.actions}>
        <div className={styles.status} aria-live="polite">
          {confirmation ? (
            <span className={styles.confirmation}>
              <CheckIcon width={15} height={15} />
              {confirmation}
            </span>
          ) : dirty ? (
            <span className={styles.unsaved}>Unsaved changes</span>
          ) : null}
        </div>

        <div className={styles.buttons}>
          {dirty ? (
            <Button
              variant="ghost"
              onClick={() => {
                setValues(saved);
                setTaxText(String(saved.taxPercent));
                setErrors({});
                setConfirmation(null);
              }}
              disabled={saving}
            >
              Discard
            </Button>
          ) : null}

          <Button type="submit" disabled={saving || !dirty}>
            {saving ? 'Saving' : 'Save changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}
