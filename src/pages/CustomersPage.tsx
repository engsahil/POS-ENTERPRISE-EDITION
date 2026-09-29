/**
 * Customer records.
 *
 * Lightweight management: search, create/edit, and a detail view with the
 * customer's stats and order history. Stats are always derived from the
 * orders store, so cancelled orders can never inflate a customer's spend.
 */

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, EmptyState, Input, Textarea } from '@/components/ui';
import { CustomersIcon, PlusIcon } from '@/components/ui/Icons';
import { notifyCustomersChanged, useCustomers } from '@/hooks/useCustomers';
import {
  customerService,
  type CustomerInput,
  type CustomerStats,
} from '@/services/customerService';
import type { CustomerRecord, OrderRecord } from '@/types/domain';
import { formatMoney } from '@/utils/currency';
import { formatDate } from '@/utils/date';
import { formatPaymentMethod } from '@/utils/payment';
import styles from './CustomersPage.module.css';

type Mode =
  | { kind: 'list' }
  | { kind: 'form'; editing?: CustomerRecord }
  | { kind: 'detail'; customer: CustomerRecord };

export default function CustomersPage() {
  const { customers, loading } = useCustomers();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [query, setQuery] = useState('');

  const term = query.trim().toLowerCase();
  const visible = term
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          (c.phone ?? '').toLowerCase().includes(term),
      )
    : customers;

  if (mode.kind === 'form') {
    return (
      <CustomerForm
        editing={mode.editing}
        onDone={() => setMode({ kind: 'list' })}
        onCancel={() => setMode({ kind: 'list' })}
      />
    );
  }

  if (mode.kind === 'detail') {
    return (
      <CustomerDetail
        customer={mode.customer}
        onBack={() => setMode({ kind: 'list' })}
        onEdit={(customer) => setMode({ kind: 'form', editing: customer })}
      />
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Customers"
        subtitle="People who order, with their history and totals."
        actions={
          <Button
            onClick={() => setMode({ kind: 'form' })}
            leadingIcon={<PlusIcon width={16} height={16} />}
          >
            Add customer
          </Button>
        }
      />

      {loading ? (
        <p className={styles.loading}>Loading customers…</p>
      ) : customers.length === 0 ? (
        <EmptyState
          fill
          icon={<CustomersIcon />}
          title="No customers yet"
          description="Customers are saved automatically when an order carries a name or phone number. You can also add one here."
          action={
            <Button onClick={() => setMode({ kind: 'form' })}>Add customer</Button>
          }
        />
      ) : (
        <div className={styles.stack}>
          <Input
            label="Search customers"
            name="customerSearch"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or phone"
            autoComplete="off"
            fullWidth
          />

          <ul className={styles.list}>
            {visible.map((customer) => (
              <li key={customer.id} className={styles.row}>
                <button
                  type="button"
                  className={styles.rowButton}
                  onClick={() => setMode({ kind: 'detail', customer })}
                >
                  <span className={styles.name}>{customer.name}</span>
                  <span className={styles.meta}>
                    {customer.phone ?? 'No phone'}
                  </span>
                </button>
              </li>
            ))}
            {visible.length === 0 ? (
              <li className={styles.emptyRow}>No customer matches “{query}”.</li>
            ) : null}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Create / edit                                                       */
/* ------------------------------------------------------------------ */

function CustomerForm({
  editing,
  onDone,
  onCancel,
}: {
  editing?: CustomerRecord;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<CustomerInput>(() => ({
    name: editing?.name ?? '',
    phone: editing?.phone ?? '',
    email: editing?.email ?? '',
    address: editing?.address ?? '',
    note: editing?.note ?? '',
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setField(key: keyof CustomerInput, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!values.name.trim()) {
      setError('Customer name is required.');
      return;
    }
    setSaving(true);
    try {
      if (editing) await customerService.update(editing.id, values);
      else await customerService.create(values);
      notifyCustomersChanged();
      onDone();
    } catch {
      setError('Could not save the customer. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title={editing ? 'Edit customer' : 'Add customer'}
        subtitle="Name is enough; add details only when they are useful."
      />
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.formGrid}>
          <Input
            label="Name"
            name="customerName"
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            autoComplete="off"
            invalid={Boolean(error)}
            hint={error ?? undefined}
            disabled={saving}
            fullWidth
          />
          <Input
            label="Phone"
            name="customerPhone"
            value={values.phone}
            onChange={(e) => setField('phone', e.target.value)}
            autoComplete="off"
            hint="Used to recognise the same customer at checkout."
            disabled={saving}
            fullWidth
          />
          <Input
            label="Email"
            name="customerEmail"
            value={values.email ?? ''}
            onChange={(e) => setField('email', e.target.value)}
            autoComplete="off"
            disabled={saving}
            fullWidth
          />
          <Input
            label="Address"
            name="customerAddress"
            value={values.address ?? ''}
            onChange={(e) => setField('address', e.target.value)}
            autoComplete="off"
            disabled={saving}
            fullWidth
          />
          <Textarea
            label="Notes"
            name="customerNote"
            value={values.note ?? ''}
            onChange={(e) => setField('note', e.target.value)}
            rows={2}
            hint="Preferences or anything worth remembering."
            disabled={saving}
            fullWidth
          />
        </div>
        <div className={styles.formActions}>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving' : editing ? 'Save changes' : 'Add customer'}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Detail + history                                                    */
/* ------------------------------------------------------------------ */

function CustomerDetail({
  customer,
  onBack,
  onEdit,
}: {
  customer: CustomerRecord;
  onBack: () => void;
  onEdit: (customer: CustomerRecord) => void;
}) {
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [orders, setOrders] = useState<OrderRecord[] | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [s, o] = await Promise.all([
        customerService.stats(customer.id),
        customerService.ordersFor(customer.id),
      ]);
      if (!active) return;
      setStats(s);
      setOrders(o);
    })();
    return () => {
      active = false;
    };
  }, [customer.id]);

  return (
    <div className="page">
      <PageHeader
        title={customer.name}
        subtitle={customer.phone ?? 'No phone on record'}
        actions={
          <>
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
            <Button variant="secondary" onClick={() => onEdit(customer)}>
              Edit
            </Button>
          </>
        }
      />

      <div className={styles.stack}>
        <section className={styles.cards}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Orders</span>
            <span className={styles.statValue}>
              {stats ? stats.orderCount : '—'}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total spent</span>
            <span className={styles.statValue}>
              {stats ? formatMoney(stats.totalSpent) : '—'}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Last order</span>
            <span className={styles.statValue}>
              {stats?.lastOrderAt ? formatDate(stats.lastOrderAt) : '—'}
            </span>
          </div>
        </section>

        {customer.email || customer.address || customer.note ? (
          <section className={styles.details}>
            {customer.email ? (
              <p>
                <span className={styles.detailLabel}>Email</span>
                {customer.email}
              </p>
            ) : null}
            {customer.address ? (
              <p>
                <span className={styles.detailLabel}>Address</span>
                {customer.address}
              </p>
            ) : null}
            {customer.note ? (
              <p>
                <span className={styles.detailLabel}>Note</span>
                {customer.note}
              </p>
            ) : null}
          </section>
        ) : null}

        <section className={styles.history}>
          <h2 className={styles.historyTitle}>Order history</h2>
          {orders === null ? (
            <p className={styles.loading}>Loading history…</p>
          ) : orders.length === 0 ? (
            <p className={styles.loading}>No orders yet for this customer.</p>
          ) : (
            <ul className={styles.list}>
              {orders.map((order) => {
                const cancelled = order.status === 'cancelled';
                return (
                  <li
                    key={order.id}
                    className={
                      cancelled ? `${styles.orderRow} ${styles.orderCancelled}` : styles.orderRow
                    }
                  >
                    <span className={styles.orderMain}>
                      <span className={styles.orderNumber}>#{order.orderNumber}</span>
                      <span className={styles.meta}>
                        {formatDate(order.completedAt ?? order.createdAt)}
                        {' · '}
                        {order.orderType === 'dine-in'
                          ? 'Dine-In'
                          : order.orderType === 'delivery'
                            ? 'Delivery'
                            : 'Takeaway'}
                        {' · '}
                        {formatPaymentMethod(order.paymentMethod)}
                      </span>
                    </span>
                    {cancelled ? (
                      <span className={styles.cancelledBadge}>Cancelled</span>
                    ) : null}
                    <span className={styles.orderTotal}>
                      {formatMoney(order.grandTotal)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
