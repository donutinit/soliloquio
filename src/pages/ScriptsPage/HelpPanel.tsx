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
          <p>Create a script or import documents: Word (.docx), PDF, OpenDocument (.odt), RTF, HTML, Markdown, plain text, subtitles (.srt, .vtt), or a Soliloquio backup. Word, OpenDocument, and HTML keep their headings and emphasis.</p>
        </section>
        <section>
          <h3>2. Read</h3>
          <p>Press START for automatic scrolling. Controls hide after one second; tap the script or press a key to bring them back. Drag or use the mouse wheel to move manually.</p>
          <p>Speed is in words per minute, so changing text size or margins keeps your pace. Script cards and the editor show the estimated reading time.</p>
        </section>
        <section>
          <h3>3. Format</h3>
          <ul>
            <li><code># Heading</code> starts a section; jump with the section buttons or the list.</li>
            <li><code>&gt; Note</code> shows a small gold cue that is not counted as spoken text.</li>
            <li><code>---</code> on its own line pauses scrolling when it reaches the reading area. Press START to continue.</li>
            <li><code>**bold**</code> and <code>*italic*</code> stay visible as emphasis.</li>
          </ul>
        </section>
        <section>
          <h3>Keyboard</h3>
          <p>Space starts or pauses. Up/Down scroll, Page Up/Down move farther, Home/End jump to the start or end, Left/Right change sections, and +/− adjust speed. Tab reveals and focuses playback controls.</p>
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
            <li>
              On 8BitDo Pro 3, map L4/R4/PL/PR to Select+A / Select+B / Select+X / Select+Y on the
              controller (hold the extra and its combination, then press Star) to assign those
              four controls independently in Safari.
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
