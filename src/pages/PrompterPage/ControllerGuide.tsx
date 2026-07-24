import { GAMEPAD_ACTIONS, type GamepadAction, type GamepadBindings } from '../../types';
import { useModalFocus } from '../../app/useModalFocus';
import { ACTION_GROUPS, actionLabel, buttonLabel } from '../../features/gamepad/actionCatalog';
import type { ControllerFamily } from '../../features/gamepad/controllerIdentity';
import { ControllerDiagram } from './ControllerDiagram';
import styles from './PrompterPage.module.css';

function familyLabel(family: ControllerFamily): string {
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
  connected,
  onClose
}: {
  bindings: GamepadBindings;
  family: ControllerFamily;
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
            <h2 id="controller-guide-title">{familyLabel(family)} controls</h2>
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
            >
              <ControllerDiagram family={family} entries={entries} />
            </div>

            <div className={styles.stickGuide}>
              <span>
                <strong>L</strong> Left stick · fast scroll
              </span>
              <span>
                <strong>R</strong> Right stick · fine scroll
              </span>
            </div>
          </div>

          <ol className={styles.controllerLegend} aria-label="Controller button assignments">
            {entries.map(({ action, marker, buttonIndex, hint }) => (
              <li key={action} data-testid={`controller-guide-${action}`} tabIndex={0}>
                <span className={styles.controllerLegendMarker}>{marker}</span>
                <span className={styles.controllerLegendText}>
                  <strong>{actionLabel(action)}</strong>
                  <span>
                    {buttonLabel(buttonIndex, family)}
                    {hint ? ` · ${hint}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <p className={styles.controllerGuideNote}>Remap any action from App settings → Gamepad.</p>
      </div>
    </div>
  );
}
