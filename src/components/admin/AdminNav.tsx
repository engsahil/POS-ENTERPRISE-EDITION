import styles from './AdminNav.module.css';

export interface AdminSection {
  id: string;
  label: string;
}

export interface AdminNavProps {
  sections: AdminSection[];
  active: string;
  onSelect: (id: string) => void;
}

/**
 * Section switcher for the Admin panel.
 *
 * A vertical rail on desktop, a horizontal scroller on narrow screens. Uses
 * a tablist so the whole panel is keyboard navigable with arrow keys.
 */
export function AdminNav({ sections, active, onSelect }: AdminNavProps) {
  function handleKey(event: React.KeyboardEvent, index: number) {
    const last = sections.length - 1;
    let next: number | null = null;

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      next = index === last ? 0 : index + 1;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      next = index === 0 ? last : index - 1;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = last;
    }

    if (next === null) return;
    event.preventDefault();
    const target = sections[next];
    if (target) onSelect(target.id);
  }

  return (
    <nav className={styles.nav} aria-label="Admin sections">
      <div className={styles.list} role="tablist" aria-orientation="vertical">
        {sections.map((section, index) => {
          const selected = section.id === active;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              id={`admin-tab-${section.id}`}
              aria-selected={selected}
              aria-controls={`admin-panel-${section.id}`}
              tabIndex={selected ? 0 : -1}
              className={`${styles.item} ${selected ? styles.active : ''}`}
              onClick={() => onSelect(section.id)}
              onKeyDown={(e) => handleKey(e, index)}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
