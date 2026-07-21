import { GAMEPAD_ACTIONS, type GamepadAction, type GamepadBindings } from '../../types';
import { useModalFocus } from '../../app/useModalFocus';
import { ACTION_GROUPS, actionLabel, buttonLabel } from '../../features/gamepad/actionCatalog';
import type { ControllerFamily } from '../../features/gamepad/controllerIdentity';
import styles from './PrompterPage.module.css';

type DiagramPoint = { x: number; y: number };

const BUTTON_POINTS: Partial<Record<number, DiagramPoint>> = {
  0: { x: 430, y: 193 },
  1: { x: 459, y: 164 },
  2: { x: 401, y: 164 },
  3: { x: 430, y: 135 },
  4: { x: 169, y: 72 },
  5: { x: 431, y: 72 },
  6: { x: 196, y: 40 },
  7: { x: 404, y: 40 },
  8: { x: 226, y: 125 },
  9: { x: 374, y: 125 },
  10: { x: 234, y: 225 },
  11: { x: 366, y: 225 },
  12: { x: 158, y: 135 },
  13: { x: 158, y: 193 },
  14: { x: 129, y: 164 },
  15: { x: 187, y: 164 },
  16: { x: 300, y: 207 },
  17: { x: 300, y: 134 }
};

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
              aria-hidden="true"
            >
              <svg viewBox="0 0 600 310">
                <path
                  className={styles.controllerBody}
                  d="M162 78c-48-2-78 24-96 70L35 244c-14 44 40 72 70 36l64-69h262l64 69c30 36 84 8 70-36l-31-96c-18-46-48-72-96-70-34 2-57 13-78 29H240c-21-16-44-27-78-29Z"
                />
                <rect
                  className={styles.controllerSurface}
                  x="239"
                  y="105"
                  width="122"
                  height="58"
                  rx="13"
                />
                <path className={styles.controllerControl} d="M158 132v64M126 164h64" />
                <circle className={styles.controllerControl} cx="430" cy="135" r="13" />
                <circle className={styles.controllerControl} cx="459" cy="164" r="13" />
                <circle className={styles.controllerControl} cx="430" cy="193" r="13" />
                <circle className={styles.controllerControl} cx="401" cy="164" r="13" />
                <circle className={styles.controllerStick} cx="234" cy="225" r="27" />
                <circle className={styles.controllerStick} cx="366" cy="225" r="27" />
                <path
                  className={styles.controllerShoulder}
                  d="M132 81c20-25 47-36 82-32M468 81c-20-25-47-36-82-32"
                />
                <circle className={styles.controllerHome} cx="300" cy="207" r="14" />
                {entries.map(({ action, marker, buttonIndex }) => {
                  const point = BUTTON_POINTS[buttonIndex];
                  if (!point) return null;
                  return (
                    <g key={action} transform={`translate(${point.x} ${point.y})`}>
                      <circle className={styles.controllerMarker} r="12" />
                      <text className={styles.controllerMarkerText} textAnchor="middle" dy="4">
                        {marker}
                      </text>
                    </g>
                  );
                })}
              </svg>
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
