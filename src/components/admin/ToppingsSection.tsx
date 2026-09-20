import { useEffect, useState } from 'react';
import { Button, Input } from '@/components/ui';
import { PriceInput } from './PriceInput';
import { toppingService, type ToppingInput } from '@/services/toppingService';
import type { ToppingRecord } from '@/types/domain';
import { notifyToppingsChanged } from '@/hooks/useToppings';
import { formatMoney } from '@/utils/currency';
import styles from './PanelSection.module.css';

export function ToppingsSection() {
  const [items, setItems] = useState<ToppingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number | null>(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setItems(await toppingService.list());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const input: ToppingInput = {
      name: name.trim(),
      price: price ?? 0,
      isActive: true,
    };
    try {
      if (editingId) {
        await toppingService.update(editingId, input);
      } else {
        await toppingService.create(input);
      }
      setName('');
      setPrice(0);
      setEditingId(null);
      await load();
      notifyToppingsChanged();
    } catch {
      setError('Could not save topping.');
    }
  }

  async function handleDelete(id: string) {
    await toppingService.remove(id);
    await load();
    notifyToppingsChanged();
  }

  function startEdit(item: ToppingRecord) {
    setEditingId(item.id);
    setName(item.name);
    setPrice(item.price);
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>{editingId ? 'Edit topping' : 'Add topping'}</h3>
        <form onSubmit={handleSave} className={styles.stack}>
          <Input
            label="Name"
            name="toppingName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <PriceInput label="Extra price" name="toppingPrice" value={price} onChange={setPrice} />
          {error ? <p className={styles.failure}>{error}</p> : null}
          <div className={styles.actions}>
            {editingId ? (
              <Button variant="ghost" type="button" onClick={() => { setEditingId(null); setName(''); setPrice(0); }}>
                Cancel
              </Button>
            ) : null}
            <Button type="submit">{editingId ? 'Save' : 'Add'}</Button>
          </div>
        </form>
      </section>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Toppings ({items.length})</h3>
        {loading ? <p className={styles.loading}>Loading…</p> : null}
        {!loading && items.length === 0 ? <p className={styles.hint}>No toppings yet.</p> : null}
        <div className={styles.details}>
          {items.map((t) => (
            <div key={t.id} className={styles.row}>
              <span className={styles.rowLabel}>{t.name} · {formatMoney(t.price)}</span>
              <span className={styles.actions}>
                <Button variant="ghost" size="sm" onClick={() => startEdit(t)}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => void handleDelete(t.id)}>Delete</Button>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
