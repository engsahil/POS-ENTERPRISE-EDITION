import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/app/routes';
import { ChevronRightIcon } from '@/components/ui/Icons';
import { dealService } from '@/services/dealService';
import { inventoryService } from '@/services/inventoryService';
import { menuService } from '@/services/menuService';
import { salesService } from '@/services/salesService';
import { formatMoney } from '@/utils/currency';
import styles from './PanelSection.module.css';

interface Counts {
  menu: number;
  activeMenu: number;
  inventory: number;
  lowStock: number;
  deals: number;
  publishedDeals: number;
  todayTotal: number;
  todayOrders: number;
}

/**
 * At-a-glance state of the terminal.
 *
 * Every number is read from the database. Nothing is estimated, and with an
 * empty install every figure is genuinely zero.
 */
export function DashboardSection() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [menu, inventory, deals, overview] = await Promise.all([
        menuService.list(),
        inventoryService.list(),
        dealService.list(),
        salesService.overview(),
      ]);
      if (!active) return;

      setCounts({
        menu: menu.length,
        activeMenu: menu.filter((m) => m.item.isActive === 1).length,
        inventory: inventory.length,
        lowStock: inventory.filter(
          (i) => i.status === 'low-stock' || i.status === 'out-of-stock',
        ).length,
        deals: deals.length,
        publishedDeals: deals.filter((d) => d.record.isPublished === 1).length,
        todayTotal: overview.today.total,
        todayOrders: overview.today.orderCount,
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!counts) {
    return <p className={styles.loading}>Loading dashboard…</p>;
  }

  const links = [
    {
      title: 'Menu',
      meta: `${counts.menu} item${counts.menu === 1 ? '' : 's'} · ${counts.activeMenu} available`,
      path: ROUTE_PATHS.menu,
    },
    {
      title: 'Inventory',
      meta:
        counts.inventory === 0
          ? 'No stock lines'
          : `${counts.inventory} line${counts.inventory === 1 ? '' : 's'} · ${counts.lowStock} need attention`,
      path: ROUTE_PATHS.inventory,
    },
    {
      title: 'Deals',
      meta: `${counts.deals} deal${counts.deals === 1 ? '' : 's'} · ${counts.publishedDeals} published`,
      path: ROUTE_PATHS.deals,
    },
    {
      title: 'Sales',
      meta: 'Daily, weekly and monthly totals',
      path: ROUTE_PATHS.sales,
    },
  ];

  return (
    <div className={styles.stack}>
      <section className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricValue}>
            {formatMoney(counts.todayTotal)}
          </span>
          <span className={styles.metricLabel}>Sales today</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{counts.todayOrders}</span>
          <span className={styles.metricLabel}>Orders today</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{counts.activeMenu}</span>
          <span className={styles.metricLabel}>Items available</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{counts.lowStock}</span>
          <span className={styles.metricLabel}>Stock alerts</span>
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Manage</h3>
        <p className={styles.hint}>
          Menu, inventory and deals each have a dedicated screen.
        </p>

        <div className={styles.links}>
          {links.map((link) => (
            <button
              key={link.title}
              type="button"
              className={styles.link}
              onClick={() => navigate(link.path)}
            >
              <span className={styles.linkText}>
                <span className={styles.linkTitle}>{link.title}</span>
                <span className={styles.linkMeta}>{link.meta}</span>
              </span>
              <ChevronRightIcon
                width={18}
                height={18}
                className={styles.linkArrow}
              />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
