import { GAMEPAD_ACTIONS, type GamepadAction, type GamepadBindings } from '../../types';
import { useModalFocus } from '../../app/useModalFocus';
import { ACTION_GROUPS, actionLabel, buttonLabel } from '../../features/gamepad/actionCatalog';
import { MICRO_FIXED_ACTION_LABELS } from '../../features/gamepad/microProfile';
import type { ControllerFamily } from '../../features/gamepad/controllerIdentity';
import { ControllerDiagram } from './ControllerDiagram';
import styles from './PrompterPage.module.css';

function familyLabel(family: ControllerFamily, micro: boolean, pro3: boolean): string {
  if (micro) return '8BitDo Micro';
  if (pro3) return '8BitDo Pro 3';
  switch (family) {
    case 'playstation':
      return 'PlayStation';
    case 'xbox':
      return 'Xbox';
    case 'nintendo':
      return 'Nintendo';
    case '8bitdo':
      return '8BitDo';
    default:
      return 'Standard controller';
  }
}

function actionHint(action: GamepadAction): string | undefined {
  for (const group of ACTION_GROUPS) {
    const match = group.actions.find((item) => item.action === action);
    if (match) return match.hint;
  }
  return undefined;
}

export function ControllerGuide({
  bindings,
  family,
  micro,
  pro3,
  connected,
  onClose
}: {
  bindings: GamepadBindings;
  family: ControllerFamily;
  micro: boolean;
  pro3: boolean;
  connected: boolean;
  onClose: () => void;
}) {
  const dialogRef = useModalFocus<HTMLDivElement>(onClose);
  const entries = GAMEPAD_ACTIONS.map((action, index) => ({
    action,
    marker: index + 1,
    buttonIndex: bindings[action],
    hint: actionHint(action)
  }));

  return (
    <div className={styles.panelBackdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${styles.panel} ${styles.controllerGuide}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="controller-guide-title"
        data-testid="controller-guide"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.controllerGuideHeader}>
          <div>
            <p>{connected ? 'Connected controller' : 'Saved button layout'}</p>
            <h2 id="controller-guide-title">{familyLabel(family, micro, pro3)} controls</h2>
          </div>
          <div className={styles.controllerGuideHeaderActions}>
            <span
              className={connected ? styles.controllerLive : styles.controllerIdle}
              role="status"
            >
              {connected ? 'Live' : 'Reference'}
            </span>
            <button type="button" data-modal-autofocus onClick={onClose}>
              Done
            </button>
          </div>
        </header>

        <div className={styles.controllerGuideLayout}>
          <div className={styles.controllerDiagramColumn}>
            <div
              className={styles.controllerDiagram}
              data-testid="controller-diagram"
              data-controller-family={family}
              data-controller-model={micro ? '8bitdo-micro' : pro3 ? '8bitdo-pro-3' : family}
            >
              <ControllerDiagram
                family={family}
                model={micro ? 'micro' : pro3 ? 'pro3' : undefined}
                entries={entries}
              />
            </div>

            {micro ? (
              <div className={styles.stickGuide} data-testid="micro-controller-profile">
                <span>
                  <strong>← / →</strong> Manual scroll up / down
                </span>
                <span>
                  <strong>↑ / ↓</strong> Temporary speed 20% / 200%
                </span>
                <span>
                  <strong>Select + B</strong> Section list
                </span>
              </div>
            ) : (
              <div className={styles.stickGuide}>
                <span>
                  <strong>L</strong> Left stick · fast scroll
                </span>
                <span>
                  <strong>R</strong> Right stick · fine scroll
                </span>
              </div>
            )}
          </div>

          <ol className={styles.controllerLegend} aria-label="Controller button assignments">
            {entries.map(({ action, marker, buttonIndex, hint }) => (
              <li key={action} data-testid={`controller-guide-${action}`}>
                <span className={styles.controllerLegendMarker}>{marker}</span>
                <span className={styles.controllerLegendText}>
                  <strong>{actionLabel(action)}</strong>
                  <span>
                    {micro && MICRO_FIXED_ACTION_LABELS[action]
                      ? MICRO_FIXED_ACTION_LABELS[action]
                      : buttonLabel(buttonIndex, family)}
                    {hint ? ` · ${hint}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <p className={styles.controllerGuideNote}>
          {micro
            ? 'The Micro profile reserves Select combinations and the D-pad; remap the remaining actions in App settings → Gamepad.'
            : 'Remap any action from App settings → Gamepad.'}
        </p>
      </div>
    </div>
  );
}
