import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/app/routes';
import { PageHeader } from '@/components/layout/PageHeader';
import { DealForm } from '@/components/deals/DealForm';
import { DealList } from '@/components/deals/DealList';
import { Button, EmptyState, Input } from '@/components/ui';
import { PlusIcon, SearchIcon, TagIcon } from '@/components/ui/Icons';
import { notifyDealsChanged, useDeals } from '@/hooks/useDeals';
import { useMenu } from '@/hooks/useMenu';
import { dealService, type DealView } from '@/services/dealService';
import styles from './DealsPage.module.css';

type Mode =
  | { kind: 'list' }
  | { kind: 'add' }
  | { kind: 'edit'; view: DealView };

export default function DealsPage() {
  const navigate = useNavigate();
  const { deals, loading } = useDeals();
  const { items: menuItems } = useMenu();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const term = query.trim().toLowerCase();
  const visible = term
    ? deals.filter((v) => v.record.name.toLowerCase().includes(term))
    : deals;

  async function run(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await action();
      notifyDealsChanged();
    } finally {
      setBusyId(null);
    }
  }

  if (mode.kind !== 'list') {
    const editing = mode.kind === 'edit' ? mode.view : undefined;
    return (
      <div className="page">
        <PageHeader
          title={editing ? 'Edit deal' : 'Create deal'}
          subtitle={
            editing
              ? 'Update this deal. Published changes reach the POS immediately.'
              : 'Bundle products together at a better price.'
          }
        />
        <DealForm
          key={editing?.record.id ?? 'new'}
          editing={editing}
          onDone={() => {
            notifyDealsChanged();
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
        title="Deals"
        subtitle="Bundles and offers."
        actions={
          deals.length > 0 ? (
            <div className={styles.headerActions}>
              <Input
                type="search"
                name="deals-search"
                placeholder="Search deals"
                aria-label="Search deals"
                leadingIcon={<SearchIcon />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button
                onClick={() => setMode({ kind: 'add' })}
                leadingIcon={<PlusIcon width={17} height={17} />}
              >
                Create Deal
              </Button>
            </div>
          ) : null
        }
      />

      {loading ? (
        <p className={styles.loading}>Loading deals…</p>
      ) : deals.length === 0 ? (
        <EmptyState
          fill
          icon={<TagIcon />}
          title="No deals yet"
          description={
            menuItems.length === 0
              ? 'Add menu items first, then bundle them into a deal.'
              : 'Bundle products together at a better price. Published deals appear in the POS.'
          }
          action={
            menuItems.length === 0 ? (
              <Button
                variant="secondary"
                onClick={() => navigate(ROUTE_PATHS.menu)}
              >
                Go to Menu
              </Button>
            ) : (
              <Button
                onClick={() => setMode({ kind: 'add' })}
                leadingIcon={<PlusIcon width={17} height={17} />}
              >
                Create Deal
              </Button>
            )
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          fill
          icon={<SearchIcon />}
          title="No deals match your search"
          description={`Nothing found for "${query.trim()}".`}
          action={
            <Button variant="secondary" onClick={() => setQuery('')}>
              Clear search
            </Button>
          }
        />
      ) : (
        <DealList
          deals={visible}
          busyId={busyId}
          onEdit={(view) => setMode({ kind: 'edit', view })}
          onTogglePublished={(view, published) =>
            void run(view.record.id, () =>
              dealService.setPublished(view.record.id, published),
            )
          }
          onDelete={(view) =>
            void run(view.record.id, () => dealService.remove(view.record.id))
          }
        />
      )}
    </div>
  );
}
