import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/app/routes';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  CartPanel,
  DealGrid,
  ItemGrid,
  OrderConfirmation,
} from '@/components/pos';
import { Button, EmptyState, Input } from '@/components/ui';
import { PosIcon, SearchIcon } from '@/components/ui/Icons';
import { useCart } from '@/hooks/useCart';
import { useDeals } from '@/hooks/useDeals';
import { notifyInventoryChanged } from '@/hooks/useInventory';
import { notifySalesChanged } from '@/hooks/useSales';
import { useMenu } from '@/hooks/useMenu';
import { orderService, type CompletedOrder } from '@/services/orderService';
import { SETTING_KEYS, settingsService } from '@/services/settingsService';
import type { OrderType } from '@/types/domain';
import type { CartCompletionInput } from '@/components/pos/CartPanel';
import styles from './PosPage.module.css';

export default function PosPage() {
  const navigate = useNavigate();
  const { items, loading } = useMenu({ activeOnly: true, inStockOnly: true });
  const { deals } = useDeals(true);
  const cart = useCart();

  const [query, setQuery] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState<CompletedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Order type + table + customer (lightweight)
  const [orderType, setOrderType] = useState<OrderType>('takeaway');
  const [tableLabel, setTableLabel] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const term = query.trim().toLowerCase();
  const visible = term
    ? items.filter(
        (entry) =>
          entry.item.name.toLowerCase().includes(term) ||
          (entry.item.category ?? '').toLowerCase().includes(term),
      )
    : items;

  const visibleDeals = term
    ? deals.filter((view) => view.record.name.toLowerCase().includes(term))
    : deals;

  const hasSellable = items.length > 0 || deals.length > 0;
  const nothingMatched = visible.length === 0 && visibleDeals.length === 0;

  function handleSelect(
    entry: (typeof items)[number],
    size: string,
  ): void {
    const price = entry.prices[size];
    if (price === null || price === undefined) return;

    cart.addLine({
      menuItemId: entry.item.id,
      itemPriceId: null,
      name: entry.item.name,
      sizeLabel: size,
      unitPrice: price,
    });
  }

  async function handleComplete(payment: CartCompletionInput) {
    if (cart.isEmpty) return;

    // Validate table for dine-in
    if (orderType === 'dine-in' && !tableLabel.trim()) {
      setError('Enter table number for Dine-In.');
      return;
    }

    setCompleting(true);
    setError(null);
    try {
      const result = await orderService.complete({
        lines: cart.lines,
        amountPaid: payment.amountPaid,
        discount: payment.discount,
        paymentMethod: payment.paymentMethod,
        orderType,
        tableLabel: orderType === 'dine-in' ? tableLabel.trim() : undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
      });
      cart.clear();

      const autoShow = await settingsService.get<boolean>(
        SETTING_KEYS.autoShowReceipt,
        true,
      );
      setCompleted(autoShow ? result : null);
      notifyInventoryChanged();
      notifySalesChanged();
    } catch {
      setError('Could not complete the order. Please try again.');
    } finally {
      setCompleting(false);
    }
  }

  if (completed) {
    return (
      <div className="page">
        <PageHeader title="POS" subtitle="Order saved to this device." />
        <OrderConfirmation
          completed={completed}
          onNewOrder={() => setCompleted(null)}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="POS"
        subtitle="Build an order and take payment."
        actions={
          hasSellable ? (
            <Input
              type="search"
              name="pos-search"
              placeholder="Search items"
              aria-label="Search items"
              leadingIcon={<SearchIcon />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          ) : null
        }
      />

      {loading ? (
        <p className={styles.loading}>Loading menu…</p>
      ) : !hasSellable ? (
        <EmptyState
          fill
          icon={<PosIcon />}
          title="No items available"
          description="Add items to your menu and they will appear here, ready to be added to an order. Items that are out of stock are hidden automatically."
          action={
            <Button
              variant="secondary"
              onClick={() => navigate(ROUTE_PATHS.menu)}
            >
              Go to Menu
            </Button>
          }
        />
      ) : (
        <div className={styles.layout}>
          <div className={styles.items}>
            {/* Order type selector */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {(['dine-in', 'takeaway', 'delivery'] as OrderType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrderType(type)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: orderType === type ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                    background: orderType === type ? 'var(--color-accent-soft)' : 'var(--color-surface)',
                    fontWeight: orderType === type ? 600 : 400,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {type === 'dine-in' ? 'Dine-In' : type === 'takeaway' ? 'Takeaway' : 'Delivery'}
                </button>
              ))}
            </div>

            {orderType === 'dine-in' ? (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <Input
                  name="tableLabel"
                  placeholder="Table number"
                  value={tableLabel}
                  onChange={(e) => setTableLabel(e.target.value)}
                  style={{ maxWidth: '160px' }}
                />
                <Input
                  name="customerName"
                  placeholder="Customer (optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{ maxWidth: '200px' }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <Input
                  name="customerName"
                  placeholder="Customer name (optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{ maxWidth: '200px' }}
                />
                <Input
                  name="customerPhone"
                  placeholder="Phone (optional)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  style={{ maxWidth: '200px' }}
                />
              </div>
            )}

            {nothingMatched ? (
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
              <>
                {visibleDeals.length > 0 ? (
                  <DealGrid
                    deals={visibleDeals}
                    onSelect={(view) =>
                      cart.addDeal({
                        dealId: view.record.id,
                        name: view.record.name,
                        unitPrice: view.dealPrice,
                      })
                    }
                  />
                ) : null}

                {visible.length > 0 ? (
                  <>
                    {visibleDeals.length > 0 ? (
                      <h2 className={styles.sectionTitle}>Items</h2>
                    ) : null}
                    <ItemGrid items={visible} onSelect={handleSelect} />
                  </>
                ) : null}
              </>
            )}
          </div>

          <div className={styles.cart}>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}

            <CartPanel
              lines={cart.lines}
              totals={cart.totals}
              completing={completing}
              onDiscountChange={cart.setDiscount}
              onIncrement={cart.incrementLine}
              onDecrement={cart.decrementLine}
              onRemove={cart.removeLine}
              onClear={cart.clear}
              onComplete={(input) => void handleComplete(input)}
              onUpdateToppings={cart.updateLineToppings}
              onUpdateAddOns={cart.updateLineAddOns}
            />
          </div>
        </div>
      )}
    </div>
  );
}
