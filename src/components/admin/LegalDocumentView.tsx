import type { LegalDocument } from '@/content/legal';
import styles from './LegalDocumentView.module.css';

export interface LegalDocumentViewProps {
  document: LegalDocument;
}

/**
 * Renders a legal document.
 *
 * Deliberately typographic rather than decorative: generous line height, a
 * capped measure for readability, and numbered headings that match the
 * source text so a clause can be cited unambiguously.
 */
export function LegalDocumentView({ document }: LegalDocumentViewProps) {
  return (
    <article className={styles.doc}>
      <header className={styles.head}>
        <h3 className={styles.title}>{document.title}</h3>
        <p className={styles.summary}>{document.summary}</p>
        <p className={styles.updated}>Last updated {document.updated}</p>
      </header>

      <div className={styles.body}>
        {document.sections.map((section) => (
          <section key={section.heading} className={styles.section}>
            <h4 className={styles.heading}>{section.heading}</h4>

            {section.body?.map((paragraph, index) => (
              <p key={index} className={styles.paragraph}>
                {paragraph}
              </p>
            ))}

            {section.bullets ? (
              <ul className={styles.list}>
                {section.bullets.map((bullet, index) => (
                  <li key={index} className={styles.listItem}>
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}
