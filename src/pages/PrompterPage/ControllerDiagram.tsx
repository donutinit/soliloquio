import type { GamepadAction } from '../../types';
import type { ControllerFamily } from '../../features/gamepad/controllerIdentity';
import dualShock4Image from '../../assets/controllers/dualshock-4.webp';
import xboxImage from '../../assets/controllers/xbox.webp';
import microImage from '../../assets/controllers/8bitdo-micro.webp';
import pro3Image from '../../assets/controllers/8bitdo-pro-3.webp';
import styles from './PrompterPage.module.css';

export type ControllerDiagramEntry = {
  action: GamepadAction;
  marker: number;
  buttonIndex: number;
};

type DiagramPoint = { x: number; y: number };
type ControllerPhotoModel = 'dualshock4' | 'xbox' | 'micro' | 'pro3';

type ControllerPhoto = {
  src: string;
  label: string;
  height: number;
  points: Partial<Record<number, DiagramPoint>>;
};

// Every photo uses a 640-unit display width so pins stay the same visual size
// across source files with different resolutions and aspect ratios.
const CONTROLLER_PHOTOS: Record<ControllerPhotoModel, ControllerPhoto> = {
  dualshock4: {
    src: dualShock4Image,
    label: 'DualShock 4 button layout',
    height: 409,
    points: {
      0: { x: 515, y: 170 },
      1: { x: 562, y: 126 },
      2: { x: 469, y: 126 },
      3: { x: 515, y: 82 },
      4: { x: 176, y: 24 },
      5: { x: 464, y: 24 },
      6: { x: 131, y: 12 },
      7: { x: 509, y: 12 },
      8: { x: 191, y: 59 },
      9: { x: 450, y: 59 },
      10: { x: 224, y: 240 },
      11: { x: 416, y: 240 },
      12: { x: 124, y: 79 },
      13: { x: 124, y: 169 },
      14: { x: 78, y: 124 },
      15: { x: 169, y: 124 },
      16: { x: 320, y: 213 },
      17: { x: 320, y: 94 }
    }
  },
  xbox: {
    src: xboxImage,
    label: 'Xbox controller button layout',
    height: 452,
    points: {
      0: { x: 483, y: 164 },
      1: { x: 525, y: 125 },
      2: { x: 440, y: 124 },
      3: { x: 483, y: 83 },
      4: { x: 160, y: 23 },
      5: { x: 480, y: 23 },
      6: { x: 113, y: 13 },
      7: { x: 527, y: 13 },
      8: { x: 270, y: 123 },
      9: { x: 365, y: 123 },
      10: { x: 156, y: 123 },
      11: { x: 405, y: 222 },
      12: { x: 236, y: 199 },
      13: { x: 236, y: 255 },
      14: { x: 208, y: 227 },
      15: { x: 264, y: 227 },
      16: { x: 319, y: 58 }
    }
  },
  micro: {
    src: microImage,
    label: '8BitDo Micro button layout',
    height: 371,
    points: {
      0: { x: 484, y: 246 },
      1: { x: 550, y: 187 },
      2: { x: 420, y: 187 },
      3: { x: 484, y: 123 },
      4: { x: 168, y: 20 },
      5: { x: 484, y: 20 },
      6: { x: 105, y: 15 },
      7: { x: 535, y: 15 },
      8: { x: 257, y: 114 },
      9: { x: 383, y: 114 },
      12: { x: 155, y: 134 },
      13: { x: 155, y: 244 },
      14: { x: 103, y: 190 },
      15: { x: 208, y: 190 },
      16: { x: 278, y: 263 },
      17: { x: 358, y: 263 }
    }
  },
  pro3: {
    src: pro3Image,
    label: '8BitDo Pro 3 button layout',
    height: 437,
    points: {
      0: { x: 493, y: 149 },
      1: { x: 542, y: 108 },
      2: { x: 445, y: 108 },
      3: { x: 493, y: 65 },
      4: { x: 153, y: 12 },
      5: { x: 485, y: 12 },
      6: { x: 118, y: 10 },
      7: { x: 520, y: 10 },
      8: { x: 290, y: 106 },
      9: { x: 351, y: 106 },
      10: { x: 236, y: 196 },
      11: { x: 404, y: 196 },
      12: { x: 144, y: 68 },
      13: { x: 144, y: 144 },
      14: { x: 107, y: 107 },
      15: { x: 181, y: 107 },
      16: { x: 145, y: 210 },
      17: { x: 493, y: 211 }
    }
  }
};

const MICRO_ACTION_POINTS: Partial<Record<GamepadAction, DiagramPoint>> = {
  toggleControllerGuide: { x: 257, y: 114 },
  toggleSections: { x: 484, y: 246 },
  fontUp: { x: 155, y: 134 },
  fontDown: { x: 155, y: 244 },
  marginDown: { x: 103, y: 190 },
  marginUp: { x: 208, y: 190 }
};

const GENERIC_BUTTON_POINTS: Partial<Record<number, DiagramPoint>> = {
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

function DiagramPin({
  marker,
  point,
  photo = false,
  alternateBubble = false
}: {
  marker: number;
  point: DiagramPoint;
  photo?: boolean;
  alternateBubble?: boolean;
}) {
  let bubbleTransform = photo ? 'translate(16 -16)' : 'translate(12 -12)';
  if (point.y < 34) bubbleTransform = photo ? 'translate(16 16)' : 'translate(12 12)';
  if (alternateBubble) bubbleTransform = photo ? 'translate(-16 16)' : 'translate(-12 12)';
  return (
    <g transform={`translate(${point.x} ${point.y})`}>
      <circle
        className={photo ? styles.controllerPhotoMarkerHalo : styles.controllerMarkerHalo}
        r={photo ? '22' : '18.5'}
      />
      <g transform={bubbleTransform}>
        <circle className={styles.controllerMarker} r={photo ? '15' : '10.5'} />
        <text
          className={`${styles.controllerMarkerText} ${photo ? styles.controllerPhotoMarkerText : ''}`}
          textAnchor="middle"
          dy="0.36em"
        >
          {marker}
        </text>
      </g>
    </g>
  );
}

function ControllerPhotoDiagram({
  model,
  entries
}: {
  model: ControllerPhotoModel;
  entries: ControllerDiagramEntry[];
}) {
  const photo = CONTROLLER_PHOTOS[model];
  return (
    <svg
      className={styles.controllerPhotoDiagram}
      viewBox={`0 0 640 ${photo.height}`}
      role="img"
      aria-label={photo.label}
    >
      <title>{photo.label}</title>
      <image href={photo.src} width="640" height={photo.height} />
      {entries.map(({ action, marker, buttonIndex }) => {
        const point =
          model === 'micro'
            ? MICRO_ACTION_POINTS[action] ?? photo.points[buttonIndex]
            : photo.points[buttonIndex];
        if (!point) return null;
        return (
          <DiagramPin
            key={action}
            marker={marker}
            point={point}
            photo
            alternateBubble={model === 'micro' && action === 'toggleSections'}
          />
        );
      })}
    </svg>
  );
}

function GenericControllerDiagram({ entries }: { entries: ControllerDiagramEntry[] }) {
  return (
    <svg viewBox="0 0 600 310" role="img" aria-label="Standard controller button layout">
      <path
        className={styles.controllerBody}
        d="M162 78c-48-2-78 24-96 70L35 244c-14 44 40 72 70 36l64-69h262l64 69c30 36 84 8 70-36l-31-96c-18-46-48-72-96-70-34 2-57 13-78 29H240c-21-16-44-27-78-29Z"
      />
      <rect className={styles.controllerTouchpad} x="239" y="105" width="122" height="58" rx="13" />
      <path className={styles.controllerDpadDetail} d="M158 132v64M126 164h64" />
      <circle className={styles.controllerFaceButton} cx="430" cy="135" r="13" />
      <circle className={styles.controllerFaceButton} cx="459" cy="164" r="13" />
      <circle className={styles.controllerFaceButton} cx="430" cy="193" r="13" />
      <circle className={styles.controllerFaceButton} cx="401" cy="164" r="13" />
      <circle className={styles.controllerStick} cx="234" cy="225" r="27" />
      <circle className={styles.controllerStick} cx="366" cy="225" r="27" />
      <path
        className={styles.controllerBodyHighlight}
        d="M132 81c20-25 47-36 82-32M468 81c-20-25-47-36-82-32"
      />
      <circle className={styles.controllerHome} cx="300" cy="207" r="14" />
      {entries.map(({ action, marker, buttonIndex }) => {
        const point = GENERIC_BUTTON_POINTS[buttonIndex];
        return point ? <DiagramPin key={action} marker={marker} point={point} /> : null;
      })}
    </svg>
  );
}

export function ControllerDiagram({
  family,
  model,
  entries
}: {
  family: ControllerFamily;
  model?: 'micro' | 'pro3';
  entries: ControllerDiagramEntry[];
}) {
  if (model) return <ControllerPhotoDiagram model={model} entries={entries} />;
  switch (family) {
    case 'playstation':
      return <ControllerPhotoDiagram model="dualshock4" entries={entries} />;
    case 'xbox':
      return <ControllerPhotoDiagram model="xbox" entries={entries} />;
    default:
      return <GenericControllerDiagram entries={entries} />;
  }
}
