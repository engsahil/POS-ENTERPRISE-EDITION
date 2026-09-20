import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/app/routes';
import { cn } from '@/utils/cn';
import styles from './TabBar.module.css';

/** Mobile-only bottom navigation. All four sections fit without a "More" item. */
export function TabBar() {
  const items = NAV_ITEMS.filter((item) => item.primary);

  return (
    <nav className={styles.tabbar} aria-label="Sections">
      {items.map(({ id, label, path, icon: Icon }) => (
        <NavLink
          key={id}
          to={path}
          end={path === '/'}
          className={({ isActive }) =>
            cn(styles.tab, isActive && styles.tabActive)
          }
        >
          {({ isActive }) => (
            <>
              <span className={styles.iconWrap}>
                <Icon width={20} height={20} />
                {isActive ? <span className={styles.dot} /> : null}
              </span>
              <span className={styles.label}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
