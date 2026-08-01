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
          <p>Tap START for automatic scrolling. Controls hide after one second; tap the script to bring them back or drag it to move manually.</p>
        </section>
        <section>
          <h3>3. Navigate</h3>
          <p>Markdown headings create sections. Use the section buttons or the list to jump between them.</p>
        </section>
        <section>
          <h3>Controller</h3>
          <p>Connect it over Bluetooth, then press any button.</p>
          <ul>
            <li>The south face button starts or pauses.</li>
            <li>Controller play/pause does not reveal hidden controls; use Show / hide controls.</li>
            <li>L1/LB and R1/RB change sections.</li>
            <li>Share, Create, View, Minus, or Select opens the controller guide.</li>
            <li>
              8BitDo Micro uses its fixed D-pad and Select compact profile; Select + B opens the
              section list.
            </li>
            <li>Assign actions in App settings → Gamepad.</li>
            <li>The d-pad moves focus; south activates and east closes.</li>
          </ul>
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
