import { useEffect, useState } from 'react';
import { DEFAULT_DUALSHOCK_MAPPING, type ControllerButton, type ControllerMapping } from '../../types';
import { getActiveGamepad } from '../../features/gamepad/controller';
import { useModalFocus } from '../../app/useModalFocus';
import styles from './PrompterPage.module.css';

const BUTTON_LABELS: Record<ControllerButton, string> = {
  cross: 'Cross — play/pause · hold: scroll down',
  circle: 'Circle — back to scripts',
  square: 'Square — show/hide controls',
  triangle: 'Triangle — start · hold: scroll up',
  l1: 'L1 — previous section',
  r1: 'R1 — next section',
  l2: 'L2 — slower · hold: scroll up',
  r2: 'R2 — faster · hold: scroll down',
  share: 'Share — sections',
  options: 'Options — settings',
  leftStickButton: 'Left stick button',
  rightStickButton: 'Right stick button',
  dpadUp: 'D-pad up — larger text',
  dpadDown: 'D-pad down — smaller text',
  dpadLeft: 'D-pad left — narrower margins',
  dpadRight: 'D-pad right — wider margins',
  ps: 'PS button',
  touchpad: 'Touchpad'
};

const BUTTON_NAMES: ControllerButton[] = [
  'cross',
  'circle',
  'square',
  'triangle',
  'l1',
  'r1',
  'l2',
  'r2',
  'share',
  'options',
  'dpadUp',
  'dpadDown',
  'dpadLeft',
  'dpadRight'
];

type Diagnostics = { buttons: { pressed: boolean; value: number }[]; axes: number[] } | null;

export function MappingEditor({
  mapping,
  onChange,
  onClose
}: {
  mapping: ControllerMapping;
  onChange: (mapping: ControllerMapping) => void;
  onClose: () => void;
}) {
  const [listening, setListening] = useState<ControllerButton | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostics>(null);
  const [mappingFeedback, setMappingFeedback] = useState('');

  // Al reasignar: el siguiente botón que se pulse queda asignado a la acción.
  useEffect(() => {
    if (!listening) return;
    const interval = setInterval(() => {
      const pad = getActiveGamepad();
      if (!pad) return;
      const index = pad.buttons.findIndex((b) => b.pressed || b.value > 0.5);
      if (index >= 0) {
        const conflict = BUTTON_NAMES.find(
          (name) => name !== listening && mapping[name] === index
        );
        const next = { ...mapping, [listening]: index };
        if (conflict) next[conflict] = mapping[listening];
        onChange(next);
        setMappingFeedback(
          conflict
            ? `Assigned button ${index}; ${BUTTON_LABELS[conflict]} moved to button ${mapping[listening]}.`
            : `Assigned button ${index}.`
        );
        setListening(null);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [listening, mapping, onChange]);

  // Modo diagnóstico: estado crudo de botones y ejes.
  useEffect(() => {
    if (!showDiagnostics) {
      setDiagnostics(null);
      return;
    }
    const interval = setInterval(() => {
      const pad = getActiveGamepad();
      setDiagnostics(
        pad
          ? {
              buttons: pad.buttons.map((b) => ({ pressed: b.pressed, value: b.value })),
              axes: [...pad.axes]
            }
          : null
      );
    }, 100);
    return () => clearInterval(interval);
  }, [showDiagnostics]);

  const dialogRef = useModalFocus<HTMLDivElement>(onClose);

  return (
    <div
      ref={dialogRef}
      className={styles.mappingOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mapping-title"
      data-testid="mapping-editor"
      tabIndex={-1}
    >
      <header className={styles.mappingHeader}>
        <h2 id="mapping-title">Controller mapping</h2>
        <button type="button" data-testid="mapping-close" onClick={onClose}>
          Done
        </button>
      </header>
      <p className={styles.mappingHint}>
        {listening
          ? `Press a controller button for “${BUTTON_LABELS[listening]}”…`
          : 'Choose an action, then press the controller button you want to use. Stick axes keep their standard mapping.'}
      </p>
      {mappingFeedback && <p className={styles.mappingFeedback} role="status">{mappingFeedback}</p>}
      <ul className={styles.mappingList}>
        {BUTTON_NAMES.map((name) => (
          <li key={name}>
            <button
              type="button"
              data-testid={`map-${name}`}
              className={listening === name ? styles.mappingListening : undefined}
              onClick={() => setListening((current) => (current === name ? null : name))}
            >
              <span>{BUTTON_LABELS[name]}</span>
              <span className={styles.mappingIndex}>button {mapping[name]}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.panelActions}>
        <button
          type="button"
          data-testid="mapping-reset"
          onClick={() => onChange({ ...DEFAULT_DUALSHOCK_MAPPING })}
        >
          Reset defaults
        </button>
        <button type="button" data-testid="diagnostics-toggle" onClick={() => setShowDiagnostics((v) => !v)}>
          {showDiagnostics ? 'Hide diagnostics' : 'Diagnostics'}
        </button>
      </div>
      {showDiagnostics && (
        <div className={styles.diagnostics} data-testid="diagnostics">
          {diagnostics ? (
            <>
              <p>
                Buttons:{' '}
                {diagnostics.buttons
                  .map((b, i) => `${i}:${b.pressed ? '■' : '·'}${b.value > 0 ? b.value.toFixed(2) : ''}`)
                  .join(' ')}
              </p>
              <p>Axes: {diagnostics.axes.map((a, i) => `${i}:${a.toFixed(2)}`).join(' ')}</p>
            </>
          ) : (
            <p>No active controller. Connect it and press any button.</p>
          )}
        </div>
      )}
    </div>
  );
}
