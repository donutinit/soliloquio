import type { Section } from '../../features/sections/sections';
import { useModalFocus } from '../../app/useModalFocus';
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
  const dialogRef = useModalFocus<HTMLDivElement>(onClose);
  return (
    <div className={styles.panelBackdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sections-title"
        data-testid="sections-panel"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="sections-title" className={styles.panelTitle}>Sections</h2>
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
                {section.title || 'Untitled'}
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.panelActions}>
          <button type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
