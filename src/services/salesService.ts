/**
 * Sales analytics.
 *
 * Every figure is derived from stored `sales` records written when an order
 * was completed. Nothing is estimated, projected or invented: with no orders,
 * every total is zero.
 *
 * Periods are calendar-based (the week starts on Monday), computed in local
 * time so "today" matches the operator's day rather than UTC.
 */

import { salesRepository } from '@/data/repositories';
import type { SaleRecord } from '@/types/domain';
import type { Paisa } from '@/types/common';

export type PeriodKey = 'today' | 'week' | 'month';

export interface PeriodSummary {
  key: PeriodKey;
  label: string;
  /** Sum of grand totals for completed, non-refunded sales. */
  total: Paisa;
  orderCount: number;
  /** Total items sold across those orders. */
  itemCount: number;
  /** total / orderCount, or 0 when there are no orders. */
  averageOrder: Paisa;
  /** Inclusive local-date bounds, as YYYY-MM-DD. */
  from: string;
  to: string;
}

export interface DayPoint {
  /** YYYY-MM-DD */
  date: string;
  /** Short weekday label, e.g. "Mon". */
  label: string;
  total: Paisa;
  orderCount: number;
  isToday: boolean;
}

/** Money received per payment method, in paisa. */
export interface PaymentMethodTotals {
  cash: Paisa;
  card: Paisa;
  digital: Paisa;
  other: Paisa;
}

/**
 * Cash-flow figures derived from completed, non-cancelled sales — the
 * actual payable amount per method (post-discount), never an estimate.
 */
export interface PaymentFlow {
  today: PaymentMethodTotals;
  week: PaymentMethodTotals;
  all: PaymentMethodTotals;
}

export interface SalesOverview {
  today: PeriodSummary;
  week: PeriodSummary;
  month: PeriodSummary;
  /** Current calendar week, Monday to Sunday, for the daily chart. */
  weekDays: DayPoint[];
  /** Received money per payment method over three windows. */
  paymentFlow: PaymentFlow;
  /**
   * Most recent sales, newest first — includes cancelled rows so history
   * keeps its audit trail (flagged, never counted in any total).
   */
  recent: SaleRecord[];
  /** True when no sale has ever been recorded. */
  isEmpty: boolean;
}

/** Local calendar date key, matching how orderService stamps businessDate. */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Monday of the calendar week containing `date`. */
export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  // getDay(): 0 = Sunday. Shift so Monday is the first day.
  const offset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  return result;
}

export function startOfMonth(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * A sale counts towards analytics and cash flow only while it is a real,
 * completed sale: cancelled and refunded rows are excluded from every
 * figure but kept in the record itself for the audit trail.
 * Soft-deleted records are already excluded by the repository.
 */
export function isCountable(sale: SaleRecord): boolean {
  return !sale.refundedAt && !sale.cancelledAt;
}

/** Treat a non-finite stored value as zero rather than poisoning the sum. */
function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function emptyFlow(): PaymentMethodTotals {
  return { cash: 0, card: 0, digital: 0, other: 0 };
}

/** Route a sale's amount into the right per-method bucket. */
function addToFlow(
  flow: PaymentMethodTotals,
  method: SaleRecord['paymentMethod'],
  amount: number,
): void {
  switch (method) {
    case 'cash':
      flow.cash += amount;
      break;
    case 'card':
      flow.card += amount;
      break;
    case 'digital':
      flow.digital += amount;
      break;
    default:
      flow.other += amount;
  }
}

function summarise(
  key: PeriodKey,
  label: string,
  sales: SaleRecord[],
  from: string,
  to: string,
): PeriodSummary {
  const inRange = sales.filter(
    (s) => s.businessDate >= from && s.businessDate <= to,
  );

  /*
   * Defensive aggregation. Validation now prevents bad rows being written,
   * but a database may already contain one from an earlier build, and a
   * single NaN would otherwise make the whole day's figure unreadable.
   */
  const total = inRange.reduce((sum, s) => sum + safeNumber(s.grandTotal), 0);
  const itemCount = inRange.reduce((sum, s) => sum + safeNumber(s.itemCount), 0);
  const orderCount = inRange.length;

  return {
    key,
    label,
    total,
    orderCount,
    itemCount,
    // Guard the division: no orders means zero, never NaN.
    averageOrder: orderCount > 0 ? Math.round(total / orderCount) : 0,
    from,
    to,
  };
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const salesService = {
  dateKey,
  startOfWeek,
  startOfMonth,

  /** Every countable sale record. */
  async allSales(): Promise<SaleRecord[]> {
    const sales = await salesRepository.list();
    return sales.filter(isCountable);
  },

  /**
   * Daily, weekly and monthly figures plus a per-day breakdown of the
   * current week. `now` is injectable so the calculation is testable.
   */
  async overview(now: Date = new Date()): Promise<SalesOverview> {
    const all = await salesRepository.list();
    // Totals use only countable sales; `all` (including cancelled) feeds
    // the history list so a cancelled order stays visible but flagged.
    const sales = all.filter(isCountable);

    const todayKey = dateKey(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);
    const weekKey = dateKey(weekStart);

    const today = summarise('today', 'Today', sales, todayKey, todayKey);
    const week = summarise(
      'week',
      'This week',
      sales,
      dateKey(weekStart),
      todayKey,
    );
    const month = summarise(
      'month',
      'This month',
      sales,
      dateKey(monthStart),
      todayKey,
    );

    // Per-day totals for the current week, including days with no sales so
    // the chart shows a real, gap-free week rather than only busy days.
    const weekDays: DayPoint[] = [];
    for (let i = 0; i < 7; i += 1) {
      const day = addDays(weekStart, i);
      const key = dateKey(day);
      const daySales = sales.filter((s) => s.businessDate === key);
      weekDays.push({
        date: key,
        label: WEEKDAY_LABELS[i] ?? '',
        total: daySales.reduce((sum, s) => sum + safeNumber(s.grandTotal), 0),
        orderCount: daySales.length,
        isToday: key === todayKey,
      });
    }

    // Cash flow: actual post-discount amounts per payment method, from
    // completed sales only (cancelled/refunded rows never contribute).
    const paymentFlow: PaymentFlow = {
      today: emptyFlow(),
      week: emptyFlow(),
      all: emptyFlow(),
    };
    for (const sale of sales) {
      const amount = safeNumber(sale.grandTotal);
      addToFlow(paymentFlow.all, sale.paymentMethod, amount);
      if (sale.businessDate === todayKey) {
        addToFlow(paymentFlow.today, sale.paymentMethod, amount);
      }
      if (sale.businessDate >= weekKey) {
        addToFlow(paymentFlow.week, sale.paymentMethod, amount);
      }
    }

    const recent = [...all]
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .slice(0, 10);

    return {
      today,
      week,
      month,
      weekDays,
      paymentFlow,
      recent,
      isEmpty: all.length === 0,
    };
  },
};
