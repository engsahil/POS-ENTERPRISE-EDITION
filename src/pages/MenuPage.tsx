import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { MenuItemForm } from '@/components/menu/MenuItemForm';
import { MenuItemList } from '@/components/menu/MenuItemList';
import { Button, EmptyState, Input } from '@/components/ui';
import { MenuBookIcon, PlusIcon, SearchIcon } from '@/components/ui/Icons';
import { notifyMenuChanged, useMenu } from '@/hooks/useMenu';
import { menuService, type MenuItemWithPrices } from '@/services/menuService';
import styles from './MenuPage.module.css';

type Mode =
  | { kind: 'list' }
  | { kind: 'add' }
  | { kind: 'edit'; entry: MenuItemWithPrices };

export default function MenuPage() {
  const { items, loading } = useMenu();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const term = query.trim().toLowerCase();
  const visible = term
    ? items.filter(
        (entry) =>
          entry.item.name.toLowerCase().includes(term) ||
          (entry.item.category ?? '').toLowerCase().includes(term),
      )
    : items;

  async function handleToggle(entry: MenuItemWithPrices, active: boolean) {
    setBusyId(entry.item.id);
    try {
      await menuService.setActive(entry.item.id, active);
      notifyMenuChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(entry: MenuItemWithPrices) {
    setBusyId(entry.item.id);
    try {
      await menuService.remove(entry.item.id);
      notifyMenuChanged();
    } finally {
      setBusyId(null);
    }
  }

  if (mode.kind !== 'list') {
    const editing = mode.kind === 'edit' ? mode.entry : undefined;
    return (
      <div className="page">
        <PageHeader
          title={editing ? 'Edit item' : 'Add item'}
          subtitle={
            editing
              ? 'Update this item. Changes apply to the POS immediately.'
              : 'New items become available in the POS as soon as they are saved.'
          }
        />
        <MenuItemForm
          // Remount when switching records so the form state resets cleanly.
          key={editing?.item.id ?? 'new'}
          editing={editing}
          onDone={() => {
            notifyMenuChanged();
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
        title="Menu"
        subtitle="Items, categories and prices."
        actions={
          items.length > 0 ? (
            <div className={styles.headerActions}>
              <Input
                type="search"
                name="menu-search"
                placeholder="Search items"
                aria-label="Search menu items"
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
        <p className={styles.loading}>Loading menu…</p>
      ) : items.length === 0 ? (
        <EmptyState
          fill
          icon={<MenuBookIcon />}
          title="No menu items yet"
          description="Items you add are saved on this device and appear in the POS straight away."
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
        <MenuItemList
          items={visible}
          busyId={busyId}
          onEdit={(entry) => setMode({ kind: 'edit', entry })}
          onToggleActive={(entry, active) => void handleToggle(entry, active)}
          onDelete={(entry) => void handleDelete(entry)}
        />
      )}
    </div>
  );
}
