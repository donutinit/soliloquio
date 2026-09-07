import type { AdjustmentFeedback } from './prompterDisplay';
import { ADJUSTMENT_DISPLAY, adjustmentProgress } from './prompterDisplay';
import { cssVars } from '../../styles/cssVars';
import styles from './PrompterPage.module.css';

export function AdjustmentFeedbackToast({ feedback }: { feedback: AdjustmentFeedback }) {
  const adjustmentStyle = cssVars({
    '--adjustment-progress': `${adjustmentProgress(feedback.key, feedback.value)}%`
  });
  return (
    <div
      className={`${styles.adjustmentFeedback} ${
        feedback.phase === 'exiting' ? styles.adjustmentFeedbackExiting : ''
      }`}
      style={adjustmentStyle}
      data-testid="adjustment-feedback"
      data-setting={feedback.key}
      data-phase={feedback.phase}
      role="status"
      aria-live="polite"
    >
      <span className={styles.adjustmentLabel}>
        {ADJUSTMENT_DISPLAY[feedback.key].label}
      </span>
      <strong
        className={styles.adjustmentValue}
        data-testid="adjustment-feedback-value"
      >
        <span>{feedback.value}</span>
        {ADJUSTMENT_DISPLAY[feedback.key].unit && (
          <span className={styles.adjustmentUnit}>
            {ADJUSTMENT_DISPLAY[feedback.key].unit}
          </span>
        )}
      </strong>
      <span className={styles.adjustmentMeter} aria-hidden="true" />
    </div>
  );
}
