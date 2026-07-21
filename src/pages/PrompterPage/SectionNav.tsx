import type { Section } from '../../features/sections/sections';
import styles from './PrompterPage.module.css';

export function SectionNav({
  sections,
  currentIndex,
  onSelect,
  onClose
}: {
  sections: Section[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.panelBackdrop} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-label="Secciones"
        data-testid="sections-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <ul className={styles.sectionList}>
          {sections.map((section, index) => (
            <li key={section.id}>
              <button
                type="button"
                data-testid="section-item"
                className={index === currentIndex ? styles.sectionCurrent : undefined}
                onClick={() => onSelect(index)}
              >
                <span className={styles.sectionNumber}>{index + 1}</span>
                {section.title || 'Sin título'}
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.panelActions}>
          <button type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
