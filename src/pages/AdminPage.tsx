import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  AboutSection,
  AdminNav,
  DashboardSection,
  InstallSection,
  ManageLinkSection,
  PrinterSection,
  RestaurantProfileForm,
  SecuritySection,
  SettingsSection,
  ToppingsSection,
  AddOnsSection,
  type AdminSection,
} from '@/components/admin';
import { Button } from '@/components/ui';
import { AlertIcon, LogoutIcon } from '@/components/ui/Icons';
import { ROUTE_PATHS } from '@/app/routes';
import { useAuth } from '@/app/AuthContext';
import { useDeals } from '@/hooks/useDeals';
import { useInventory } from '@/hooks/useInventory';
import { useMenu } from '@/hooks/useMenu';
import styles from './AdminPage.module.css';

const SECTIONS: AdminSection[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'menu', label: 'Menu' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'deals', label: 'Deals' },
  { id: 'toppings', label: 'Toppings' },
  { id: 'addons', label: 'Add-ons' },
  { id: 'restaurant', label: 'Restaurant Profile' },
  { id: 'printer', label: 'Printer' },
  { id: 'install', label: 'Install' },
  { id: 'security', label: 'Security' },
  { id: 'settings', label: 'Settings' },
  { id: 'about', label: 'About' },
];

/** Remember the open section across reloads without touching the database. */
const SECTION_STORAGE_KEY = 'pos.admin.section';

export default function AdminPage() {
  const { user, logout } = useAuth();
  const { items: menuItems } = useMenu();
  const { items: stock } = useInventory();
  const { deals } = useDeals();

  const [active, setActive] = useState<string>(() => {
    try {
      const stored = window.sessionStorage.getItem(SECTION_STORAGE_KEY);
      return stored && SECTIONS.some((s) => s.id === stored)
        ? stored
        : 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem(SECTION_STORAGE_KEY, active);
    } catch {
      /* session storage is a convenience only */
    }
  }, [active]);

  const menuStats = useMemo(
    () => [
      { label: 'Items', value: menuItems.length },
      {
        label: 'Available',
        value: menuItems.filter((m) => m.item.isActive === 1).length,
      },
      {
        label: 'Without a price',
        value: menuItems.filter((m) => m.availableSizes.length === 0).length,
      },
    ],
    [menuItems],
  );

  const stockStats = useMemo(
    () => [
      { label: 'Stock lines', value: stock.length },
      {
        label: 'Low stock',
        value: stock.filter((i) => i.status === 'low-stock').length,
      },
      {
        label: 'Out of stock',
        value: stock.filter((i) => i.status === 'out-of-stock').length,
      },
    ],
    [stock],
  );

  const dealStats = useMemo(
    () => [
      { label: 'Deals', value: deals.length },
      {
        label: 'Published',
        value: deals.filter((d) => d.record.isPublished === 1).length,
      },
      {
        label: 'Not sellable',
        value: deals.filter((d) => !d.isSellable).length,
      },
    ],
    [deals],
  );

  const panels: Record<string, React.ReactNode> = {
    dashboard: <DashboardSection />,
    menu: (
      <ManageLinkSection
        title="Menu"
        description="Items, categories, sizes and prices are managed on the Menu screen."
        stats={menuStats}
        actionLabel="Open Menu"
        path={ROUTE_PATHS.menu}
      />
    ),
    inventory: (
      <ManageLinkSection
        title="Inventory"
        description="Stock levels, availability and menu links are managed on the Inventory screen."
        stats={stockStats}
        actionLabel="Open Inventory"
        path={ROUTE_PATHS.inventory}
      />
    ),
    deals: (
      <ManageLinkSection
        title="Deals"
        description="Bundles, pricing and publishing are managed on the Deals screen."
        stats={dealStats}
        actionLabel="Open Deals"
        path={ROUTE_PATHS.deals}
      />
    ),
    restaurant: <RestaurantProfileForm />,
    printer: <PrinterSection />,
    install: <InstallSection />,
    security: <SecuritySection />,
    toppings: <ToppingsSection />,
    addons: <AddOnsSection />,
    settings: <SettingsSection onOpenAbout={() => setActive('about')} />,
    about: <AboutSection />,
  };

  const activeLabel =
    SECTIONS.find((s) => s.id === active)?.label ?? 'Dashboard';

  return (
    <div className="page">
      <PageHeader
        title="Admin"
        subtitle="Configure this terminal."
        actions={
          <Button
            variant="secondary"
            onClick={logout}
            leadingIcon={<LogoutIcon width={17} height={17} />}
          >
            Sign out
          </Button>
        }
      />

      {user?.mustChangePassword && active !== 'security' ? (
        <button
          type="button"
          className={styles.notice}
          onClick={() => setActive('security')}
        >
          <AlertIcon width={18} height={18} className={styles.noticeIcon} />
          <span>
            <span className={styles.noticeTitle}>Set your own password</span>
            <span className={styles.noticeBody}>
              This terminal is still using its one-time setup password. Open
              Security to choose your own before putting the till into use.
            </span>
          </span>
        </button>
      ) : null}

      <div className={styles.layout}>
        <AdminNav sections={SECTIONS} active={active} onSelect={setActive} />

        <div
          className={styles.panel}
          role="tabpanel"
          id={`admin-panel-${active}`}
          aria-labelledby={`admin-tab-${active}`}
          tabIndex={-1}
        >
          <h2 className={styles.panelTitle}>{activeLabel}</h2>
          {panels[active]}
        </div>
      </div>
    </div>
  );
}
