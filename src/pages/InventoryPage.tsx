import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { InventoryForm } from '@/components/inventory/InventoryForm';
import { InventoryList } from '@/components/inventory/InventoryList';
import { Button, EmptyState, Input } from '@/components/ui';
import { InventoryIcon, PlusIcon, SearchIcon } from '@/components/ui/Icons';
import { useInventory, notifyInventoryChanged } from '@/hooks/useInventory';
import { useMenu } from '@/hooks/useMenu';
import {
  inventoryService,
  type InventoryItemView,
} from '@/services/inventoryService';
import styles from './InventoryPage.module.css';

type Mode =
  | { kind: 'list' }
  | { kind: 'add' }
  | { kind: 'edit'; view: InventoryItemView };

export default function InventoryPage() {
  const { items, loading } = useInventory();
  const { items: menuItems } = useMenu();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const menuItemNames = useMemo(
    () => new Map(menuItems.map((entry) => [entry.item.id, entry.item.name])),
    [menuItems],
  );

  const term = query.trim().toLowerCase();
  const visible = term
    ? items.filter(
        (view) =>
          view.record.name.toLowerCase().includes(term) ||
          view.record.sku.toLowerCase().includes(term),
      )
    : items;

  const lowOrOut = items.filter(
    (view) => view.status === 'low-stock' || view.status === 'out-of-stock',
  ).length;

  async function run(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await action();
      notifyInventoryChanged();
    } finally {
      setBusyId(null);
    }
  }

  if (mode.kind !== 'list') {
    const editing = mode.kind === 'edit' ? mode.view : undefined;
    return (
      <div className="page">
        <PageHeader
          title={editing ? 'Edit stock item' : 'Add stock item'}
          subtitle={
            editing
              ? 'Update this stock line.'
              : 'Track stock for anything, and optionally link it to a menu item.'
          }
        />
        <InventoryForm
          key={editing?.record.id ?? 'new'}
          editing={editing}
          onDone={() => {
            notifyInventoryChanged();
            setMode({ kind: 'list' });
          }}
          onCancel={() => setMode({ kind: 'list' })}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Inventory"
        subtitle={
          items.length > 0 && lowOrOut > 0
            ? `${lowOrOut} item${lowOrOut === 1 ? '' : 's'} need attention.`
            : 'Stock levels for items and supplies.'
        }
        actions={
          items.length > 0 ? (
            <div className={styles.headerActions}>
              <Input
                type="search"
                name="inventory-search"
                placeholder="Search stock"
                aria-label="Search stock items"
                leadingIcon={<SearchIcon />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button
                onClick={() => setMode({ kind: 'add' })}
                leadingIcon={<PlusIcon width={17} height={17} />}
              >
                Add Item
              </Button>
            </div>
          ) : null
        }
      />

      {loading ? (
        <p className={styles.loading}>Loading inventory…</p>
      ) : items.length === 0 ? (
        <EmptyState
          fill
          icon={<InventoryIcon />}
          title="No inventory items yet"
          description="Track stock for ingredients, supplies or menu items. Everything is saved on this device."
          action={
            <Button
              onClick={() => setMode({ kind: 'add' })}
              leadingIcon={<PlusIcon width={17} height={17} />}
            >
              Add Item
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          fill
          icon={<SearchIcon />}
          title="No items match your search"
          description={`Nothing found for "${query.trim()}".`}
          action={
            <Button variant="secondary" onClick={() => setQuery('')}>
              Clear search
            </Button>
          }
        />
      ) : (
        <InventoryList
          items={visible}
          busyId={busyId}
          menuItemNames={menuItemNames}
          onEdit={(view) => setMode({ kind: 'edit', view })}
          onSetQuantity={(view, qty) =>
            void run(view.record.id, () =>
              inventoryService.setQuantity(view.record.id, qty),
            )
          }
          onMarkOutOfStock={(view) =>
            void run(view.record.id, () =>
              inventoryService.markOutOfStock(view.record.id),
            )
          }
          onRestore={(view) =>
            void run(view.record.id, () =>
              inventoryService.restoreStock(view.record.id),
            )
          }
          onDelete={(view) =>
            void run(view.record.id, () =>
              inventoryService.remove(view.record.id),
            )
          }
        />
      )}
    </div>
  );
}
