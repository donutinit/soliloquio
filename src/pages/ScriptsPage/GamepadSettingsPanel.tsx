import { useEffect, useState } from 'react';
import { DEFAULT_GAMEPAD_BINDINGS, type GamepadAction, type GamepadBindings } from '../../types';
import { getActiveGamepad } from '../../features/gamepad/controller';
import {
  ACTION_GROUPS,
  actionLabel,
  assignBinding,
  buttonLabel
} from '../../features/gamepad/actionCatalog';
import { useModalFocus } from '../../app/useModalFocus';
import { Icon } from '../../components/Icon';
import styles from './ScriptsPage.module.css';

type Diagnostics = { buttons: { pressed: boolean; value: number }[]; axes: number[] } | null;

const LISTEN_POLL_MS = 50;
const STATUS_POLL_MS = 500;
const DIAGNOSTICS_POLL_MS = 100;

export function GamepadSettingsPanel({
  bindings,
  onChange,
  onClose
}: {
  bindings: GamepadBindings;
  onChange: (bindings: GamepadBindings) => void;
  onClose: () => void;
}) {
  const [listening, setListening] = useState<GamepadAction | null>(null);
  const [feedback, setFeedback] = useState('');
  const [padId, setPadId] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostics>(null);

  // Estado de conexión: el Gamepad API solo expone el mando tras una pulsación.
  useEffect(() => {
    const read = () => {
      const pad = getActiveGamepad();
      setPadId(pad ? pad.id : null);
    };
    read();
    const interval = setInterval(read, STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // Al asignar: el siguiente botón que se pulse queda ligado a la acción.
  useEffect(() => {
    if (!listening) return;
    const interval = setInterval(() => {
      const pad = getActiveGamepad();
      if (!pad) return;
      const index = pad.buttons.findIndex((b) => b.pressed || b.value > 0.5);
      if (index < 0) return;
      const result = assignBinding(bindings, listening, index);
      onChange(result.bindings);
      setFeedback(
        result.swappedWith
          ? `${actionLabel(listening)} is now ${buttonLabel(index)}; ${actionLabel(
              result.swappedWith
            )} moved to ${buttonLabel(bindings[listening])}.`
          : `${actionLabel(listening)} is now ${buttonLabel(index)}.`
      );
      setListening(null);
    }, LISTEN_POLL_MS);
    return () => clearInterval(interval);
  }, [listening, bindings, onChange]);

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
    }, DIAGNOSTICS_POLL_MS);
    return () => clearInterval(interval);
  }, [showDiagnostics]);

  // Escape cancela primero la escucha; solo después cierra el panel.
  const requestClose = () => {
    if (listening) {
      setListening(null);
      return;
    }
    onClose();
  };
  const dialogRef = useModalFocus<HTMLDivElement>(requestClose);

  return (
    <div
      ref={dialogRef}
      className={styles.gamepadOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gamepad-settings-title"
      data-testid="gamepad-settings-panel"
      tabIndex={-1}
    >
      <header className={styles.gamepadHeader}>
        <button
          type="button"
          className={styles.gamepadBack}
          data-testid="gamepad-settings-close"
          aria-label="Back to app settings"
          onClick={onClose}
        >
          <Icon name="back" />
        </button>
        <h2 id="gamepad-settings-title">Gamepad</h2>
        <button
          type="button"
          className={styles.gamepadReset}
          data-testid="gamepad-reset"
          onClick={() => {
            setListening(null);
            onChange({ ...DEFAULT_GAMEPAD_BINDINGS });
            setFeedback('Default buttons restored.');
          }}
        >
          Reset
        </button>
      </header>

      <div
        className={padId ? styles.gamepadStatusOn : styles.gamepadStatusOff}
        data-testid="gamepad-settings-status"
        role="status"
      >
        <Icon name="gamepad" />
        <span>{padId ?? 'No controller detected. Connect one and press any button.'}</span>
      </div>

      <p className={styles.gamepadHint} aria-live="polite">
        {listening
          ? `Press a controller button for “${actionLabel(listening)}”… (Esc cancels)`
          : 'Tap an action, then press the controller button you want for it. Assigning a busy button swaps the two actions. Stick axes always scroll.'}
      </p>
      {feedback && (
        <p className={styles.gamepadFeedback} data-testid="gamepad-feedback" role="status">
          {feedback}
        </p>
      )}

      {ACTION_GROUPS.map((group) => (
        <section key={group.id} className={styles.gamepadGroup}>
          <h3>{group.title}</h3>
          <ul>
            {group.actions.map(({ action, label, hint }) => (
              <li key={action}>
                <button
                  type="button"
                  data-testid={`bind-${action}`}
                  className={listening === action ? styles.gamepadRowListening : styles.gamepadRow}
                  onClick={() => setListening((current) => (current === action ? null : action))}
                >
                  <span className={styles.gamepadActionText}>
                    <span className={styles.gamepadActionLabel}>{label}</span>
                    {hint && <span className={styles.gamepadActionHint}>{hint}</span>}
                  </span>
                  <span className={styles.gamepadChip} data-testid={`bind-${action}-value`}>
                    {listening === action ? 'Press…' : buttonLabel(bindings[action])}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className={styles.gamepadFooter}>
        <button
          type="button"
          data-testid="gamepad-diagnostics-toggle"
          onClick={() => setShowDiagnostics((v) => !v)}
        >
          {showDiagnostics ? 'Hide diagnostics' : 'Diagnostics'}
        </button>
        <button type="button" data-testid="gamepad-settings-done" onClick={onClose}>
          Done
        </button>
      </div>

      {showDiagnostics && (
        <div className={styles.gamepadDiagnostics} data-testid="gamepad-diagnostics">
          {diagnostics ? (
            <>
              <p>
                Buttons:{' '}
                {diagnostics.buttons
                  .map(
                    (b, i) => `${i}:${b.pressed ? '■' : '·'}${b.value > 0 ? b.value.toFixed(2) : ''}`
                  )
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
