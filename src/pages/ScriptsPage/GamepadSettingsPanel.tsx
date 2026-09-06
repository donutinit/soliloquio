import { useEffect, useRef, useState } from 'react';
import { DEFAULT_GAMEPAD_BINDINGS, type GamepadAction, type GamepadBindings } from '../../types';
import { getActiveGamepad } from '../../services/gamepads';
import {
  gamepadIconName,
  identifyController,
  is8BitDoMicro,
  is8BitDoPro3,
  needs8BitDoFaceButtonNormalization,
  type ControllerFamily
} from '../../features/gamepad/controllerIdentity';
import { translateNintendoFaceButtonIndex } from '../../features/gamepad/faceButtonOrder';
import { activePro3VirtualButtons } from '../../features/gamepad/pro3Profile';
import {
  isMicroFixedAction,
  MICRO_FIXED_ACTION_LABELS,
  MICRO_RESERVED_BUTTONS
} from '../../features/gamepad/microProfile';
import {
  ACTION_GROUPS,
  actionLabel,
  assignBinding,
  buttonLabel
} from '../../features/gamepad/actionCatalog';
import { useModalFocus } from '../../app/useModalFocus';
import { Icon } from '../../components/Icon';
import styles from './ScriptsPage.module.css';

type Diagnostics = {
  id: string;
  buttons: { pressed: boolean; value: number }[];
  axes: number[];
} | null;

const LISTEN_POLL_MS = 50;
const STATUS_POLL_MS = 500;
const DIAGNOSTICS_POLL_MS = 100;

export function GamepadSettingsPanel({
  bindings,
  error,
  onChange,
  onClose
}: {
  bindings: GamepadBindings;
  error: string | null;
  onChange: (bindings: GamepadBindings) => void;
  onClose: () => void;
}) {
  const [listening, setListening] = useState<GamepadAction | null>(null);
  const [feedback, setFeedback] = useState('');
  const [padName, setPadName] = useState<string | null>(null);
  // Última familia conocida: las etiquetas no vuelven a PlayStation al desconectar.
  const [family, setFamily] = useState<ControllerFamily>('playstation');
  const [micro, setMicro] = useState(false);
  const [pro3, setPro3] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostics>(null);
  const listenStateRef = useRef({ bindings, family, onChange });
  useEffect(() => {
    listenStateRef.current = { bindings, family, onChange };
  });

  // Estado de conexión: el Gamepad API solo expone el mando tras una pulsación.
  useEffect(() => {
    const read = () => {
      const pad = getActiveGamepad();
      if (!pad) {
        setPadName(null);
        return;
      }
      const identity = identifyController(pad.id);
      setPadName(identity.name);
      setFamily(identity.family);
      setMicro(is8BitDoMicro(pad.id));
      setPro3(is8BitDoPro3(pad.id));
    };
    read();
    const interval = setInterval(read, STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // Al asignar: el siguiente botón que se pulse queda ligado a la acción.
  // Solo depende de `listening`: el resto se lee por ref para no re-crear el
  // intervalo en cada render del padre.
  useEffect(() => {
    if (!listening) return;
    const interval = setInterval(() => {
      const { bindings: currentBindings, family: currentFamily, onChange: currentOnChange } =
        listenStateRef.current;
      const pad = getActiveGamepad();
      if (!pad) return;
      const rawIndex = pad.buttons.findIndex((b) => b.pressed || b.value > 0.5);
      if (rawIndex < 0) return;
      const currentMicro = is8BitDoMicro(pad.id);
      if (currentMicro && MICRO_RESERVED_BUTTONS.includes(rawIndex)) {
        setFeedback('Select and the D-pad are reserved by the 8BitDo Micro profile.');
        return;
      }
      const pro3VirtualIndex = is8BitDoPro3(pad.id)
        ? activePro3VirtualButtons(pad.buttons)[0]?.index
        : undefined;
      const index =
        pro3VirtualIndex ??
        (needs8BitDoFaceButtonNormalization(pad.id)
          ? translateNintendoFaceButtonIndex(rawIndex)
          : rawIndex);
      const result = assignBinding(currentBindings, listening, index);
      currentOnChange(result.bindings);
      setFeedback(
        result.swappedWith
          ? `${actionLabel(listening)} is now ${buttonLabel(index, currentFamily)}; ${actionLabel(
              result.swappedWith
            )} moved to ${buttonLabel(currentBindings[listening], currentFamily)}.`
          : `${actionLabel(listening)} is now ${buttonLabel(index, currentFamily)}.`
      );
      setListening(null);
    }, LISTEN_POLL_MS);
    return () => clearInterval(interval);
  }, [listening]);

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
              id: pad.id,
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
      data-gamepad-nav-suspend={listening || showDiagnostics ? 'true' : undefined}
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
        className={padName ? styles.gamepadStatusOn : styles.gamepadStatusOff}
        data-testid="gamepad-settings-status"
        role="status"
      >
        <Icon name={padName ? gamepadIconName(family) : 'gamepad'} />
        <span>{padName ?? 'No controller detected. Connect one and press any button.'}</span>
      </div>

      <p className={styles.gamepadHint} data-testid="gamepad-settings-hint" aria-live="polite">
        {listening
          ? `Press a controller button for “${actionLabel(listening)}”… Tap the action again to cancel.`
          : micro
            ? '8BitDo Micro profile: D-pad controls scrolling; hold Select with B for sections or with the D-pad for text and margins. Reserved controls are fixed.'
            : pro3
              ? '8BitDo Pro 3 profile: B confirms and A goes back. For independent extras in Safari, map L4/R4/PL/PR on the controller to Select+A / Select+B / Select+X / Select+Y, then assign them here.'
            : 'Tap an action, then press the controller button you want for it. Assigning a busy button swaps the two actions. Sticks scroll on standard-mapped controllers.'}
      </p>
      {feedback && !error && (
        <p className={styles.gamepadFeedback} data-testid="gamepad-feedback" role="status">
          {feedback}
        </p>
      )}
      {error && (
        <p className={styles.gamepadError} data-testid="gamepad-error" role="alert">
          {error}
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
                  disabled={micro && isMicroFixedAction(action)}
                  onClick={() => setListening((current) => (current === action ? null : action))}
                >
                  <span className={styles.gamepadActionText}>
                    <span className={styles.gamepadActionLabel}>{label}</span>
                    {hint && <span className={styles.gamepadActionHint}>{hint}</span>}
                  </span>
                  <span className={styles.gamepadChip} data-testid={`bind-${action}-value`}>
                    {listening === action
                      ? 'Press…'
                      : micro && MICRO_FIXED_ACTION_LABELS[action]
                        ? MICRO_FIXED_ACTION_LABELS[action]
                        : buttonLabel(bindings[action], family)}
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
              <p>Id: {diagnostics.id}</p>
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
