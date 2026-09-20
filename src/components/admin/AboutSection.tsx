import { useState } from 'react';
import { Button } from '@/components/ui';
import {
  applicationInformation,
  PRIVACY_POLICY,
  TERMS,
  VENDOR,
} from '@/content/legal';
import { LegalDocumentView } from './LegalDocumentView';
import styles from './PanelSection.module.css';
import about from './AboutSection.module.css';

type View = 'about' | 'privacy' | 'terms';

/**
 * About, legal documents and vendor attribution.
 *
 * This is the only place in the application where vendor branding appears.
 * The POS, Sales, Menu, Inventory and Deals screens carry none, so the
 * operator's own restaurant identity is what staff and customers see.
 */
export function AboutSection() {
  const [view, setView] = useState<View>('about');

  if (view === 'privacy') {
    return (
      <div className={styles.stack}>
        <BackBar onBack={() => setView('about')} />
        <LegalDocumentView document={PRIVACY_POLICY} />
      </div>
    );
  }

  if (view === 'terms') {
    return (
      <div className={styles.stack}>
        <BackBar onBack={() => setView('about')} />
        <LegalDocumentView document={TERMS} />
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      {/* ---------- Application information ---------- */}
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Application information</h3>
        <dl className={styles.details}>
          {applicationInformation().map(({ label, value }) => (
            <div key={label} className={styles.row}>
              <dt className={styles.rowLabel}>{label}</dt>
              <dd className={styles.rowValue}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------- Legal ---------- */}
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Legal</h3>
        <p className={styles.hint}>
          How this application handles your information, and the terms on
          which it is provided.
        </p>

        <div className={about.docs}>
          <button
            type="button"
            className={about.docLink}
            onClick={() => setView('privacy')}
          >
            <span className={about.docText}>
              <span className={about.docTitle}>Privacy Policy</span>
              <span className={about.docMeta}>
                What is stored, and what never leaves this device
              </span>
            </span>
            <span className={about.chevron} aria-hidden="true">
              &rsaquo;
            </span>
          </button>

          <button
            type="button"
            className={about.docLink}
            onClick={() => setView('terms')}
          >
            <span className={about.docText}>
              <span className={about.docTitle}>Terms &amp; Regulations</span>
              <span className={about.docMeta}>
                Licence, responsibilities and limitations
              </span>
            </span>
            <span className={about.chevron} aria-hidden="true">
              &rsaquo;
            </span>
          </button>
        </div>
      </section>

      {/* ---------- Vendor ---------- */}
      <section className={`${styles.card} ${about.vendor}`}>
        <span className={about.mark} aria-hidden="true">
          {VENDOR.name.charAt(0)}
        </span>
        <div className={about.vendorText}>
          <p className={about.poweredBy} data-testid="servixa-branding">
            {VENDOR.poweredBy}
          </p>
          <p className={about.vendorTagline}>{VENDOR.tagline}</p>
        </div>
      </section>
    </div>
  );
}

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <div className={about.backBar}>
      <Button variant="ghost" size="sm" onClick={onBack}>
        Back to About
      </Button>
    </div>
  );
}
