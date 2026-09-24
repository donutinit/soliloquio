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
      {blocks.map((block, index) => {
        const ref = (el: HTMLElement | null) => {
          blockElsRef.current[index] = el;
        };
        switch (block.type) {
          case 'heading':
            return (
              <div
                key={index}
                ref={ref}
                role="heading"
                aria-level={block.level}
                className={styles.heading}
                data-block-type="heading"
              >
                {block.text}
              </div>
            );
          case 'note':
            return (
              <p key={index} ref={ref} className={styles.note} data-block-type="note">
                <span className={styles.visuallyHidden}>Note: </span>
                {block.text}
              </p>
            );
          case 'pause':
            return (
              <div key={index} ref={ref} className={styles.pauseMarker} data-block-type="pause">
                <span>{block.seconds ? `Pause · ${block.seconds}s` : 'Pause'}</span>
              </div>
            );
          case 'text':
            return (
              <p
                key={index}
                ref={ref}
                className={styles.text}
                data-continuation={block.continuation ? 'true' : undefined}
                data-block-type="text"
              >
                {block.runs
                  ? block.runs.map((run, runIndex) => {
                      if (run.strong && run.emphasis) {
                        return <strong key={runIndex}><em>{run.text}</em></strong>;
                      }
                      if (run.strong) return <strong key={runIndex}>{run.text}</strong>;
                      if (run.emphasis) return <em key={runIndex}>{run.text}</em>;
                      return run.text;
                    })
                  : block.text}
              </p>
            );
        }
      })}
    </div>
  );
}
