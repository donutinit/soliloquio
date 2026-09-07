import type { CSSProperties } from 'react';
import type { PrompterBlock } from '../../types';
import type { MutableRefObject, RefObject } from 'react';
import styles from './PrompterPage.module.css';

type ReadingSurfaceProps = {
  title: string;
  blocks: PrompterBlock[];
  contentStyle: CSSProperties;
  contentRef: RefObject<HTMLDivElement>;
  blockElsRef: MutableRefObject<(HTMLElement | null)[]>;
};

export function ReadingSurface({
  title,
  blocks,
  contentStyle,
  contentRef,
  blockElsRef
}: ReadingSurfaceProps) {
  return (
    <div ref={contentRef} className={styles.content} style={contentStyle} data-testid="prompter-content">
      <div
        role="heading"
        aria-level={1}
        className={`${styles.heading} ${styles.scriptTitleHeading}`}
        data-block-type="script-title"
      >
        {title}
      </div>
      {blocks.map((block, index) =>
        block.type === 'heading' ? (
          <div
            key={index}
            ref={(el) => {
              blockElsRef.current[index] = el;
            }}
            role="heading"
            aria-level={block.level}
            className={styles.heading}
            data-block-type="heading"
          >
            {block.text}
          </div>
        ) : (
          <p
            key={index}
            ref={(el) => {
              blockElsRef.current[index] = el;
            }}
            className={styles.text}
            data-block-type="text"
          >
            {block.text}
          </p>
        )
      )}
    </div>
  );
}
