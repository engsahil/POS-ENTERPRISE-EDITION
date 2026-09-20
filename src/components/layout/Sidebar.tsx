import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/app/routes';
import { useAuth } from '@/app/AuthContext';
import { APP_CONFIG } from '@/config/app.config';
import { LogoutIcon } from '@/components/ui/Icons';
import { cn } from '@/utils/cn';
import styles from './Sidebar.module.css';

/**
 * Primary navigation.
 *   desktop -> persistent panel with labels
 *   tablet  -> compact icon rail
 *   mobile  -> hidden; the bottom tab bar takes over, so no drawer or
 *              hamburger header is needed.
 */
export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className={styles.sidebar} aria-label="Main">
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" width="17" height="17">
            <path
              d="M5 8.5h14M5 8.5 6.5 18h11L19 8.5M5 8.5 7.5 5h9L19 8.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className={styles.brandText}>
          <span className={styles.brandName}>{APP_CONFIG.name}</span>
          <span className={styles.brandMeta}>v{APP_CONFIG.version}</span>
        </span>
      </div>

      <nav className={styles.nav}>
        <ul className={styles.list}>
          {NAV_ITEMS.map(({ id, label, description, path, icon: Icon }) => (
            <li key={id}>
              <NavLink
                to={path}
                end={path === '/'}
                className={({ isActive }) =>
                  cn(styles.link, isActive && styles.linkActive)
                }
                title={label}
              >
                <span className={styles.linkIcon}>
                  <Icon width={19} height={19} />
                </span>
                <span className={styles.linkText}>
                  <span className={styles.linkLabel}>{label}</span>
                  {description ? (
                    <span className={styles.linkDescription}>
                      {description}
                    </span>
                  ) : null}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.signOut}
          onClick={logout}
          title={user ? `Sign out ${user.username}` : 'Sign out'}
        >
          <span className={styles.linkIcon}>
            <LogoutIcon width={19} height={19} />
          </span>
          <span className={styles.linkText}>
            <span className={styles.linkLabel}>Sign out</span>
            {user ? (
              <span className={styles.linkDescription}>{user.username}</span>
            ) : null}
          </span>
        </button>
      </div>
    </aside>
  );
}
