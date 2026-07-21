import { useModalFocus } from '../../app/useModalFocus';
import styles from './ScriptsPage.module.css';

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useModalFocus<HTMLDivElement>(onClose);
  return (
    <div className={styles.sheetBackdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${styles.sheet} ${styles.helpSheet}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="help-title">Quick guide</h2>
        <section>
          <h3>1. Prepare</h3>
          <p>Create a script or import Markdown, plain text, or a Teleprompter backup.</p>
        </section>
        <section>
          <h3>2. Read</h3>
          <p>Tap START for automatic scrolling. Drag the script to move manually; tap it to hide or show controls.</p>
        </section>
        <section>
          <h3>3. Navigate</h3>
          <p>Markdown headings create sections. Use the section buttons or the list to jump between them.</p>
        </section>
        <section>
          <h3>Controller</h3>
          <p>Connect it over Bluetooth, then press any button. The south face button starts or pauses; L1/LB and R1/RB change sections. Share, Create, View, Minus, or Select opens the controller guide. Assign any action to any button in App settings → Gamepad. The d-pad also moves focus: south activates and east closes.</p>
        </section>
        <section>
          <h3>Your data</h3>
          <p>Everything stays on this device. Export individual scripts or create a full JSON backup regularly.</p>
        </section>
        <button type="button" className={styles.helpDone} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
