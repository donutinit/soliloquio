import type { GamepadAction } from '../../types';
import type { ControllerFamily } from '../../features/gamepad/controllerIdentity';
import styles from './PrompterPage.module.css';

export type ControllerDiagramEntry = {
  action: GamepadAction;
  marker: number;
  buttonIndex: number;
};

type DiagramPoint = { x: number; y: number };

const DUALSHOCK_4_BUTTON_POINTS: Partial<Record<number, DiagramPoint>> = {
  0: { x: 493, y: 195 },
  1: { x: 523, y: 165 },
  2: { x: 463, y: 165 },
  3: { x: 493, y: 135 },
  4: { x: 181, y: 82 },
  5: { x: 459, y: 82 },
  6: { x: 181, y: 45 },
  7: { x: 459, y: 45 },
  8: { x: 244, y: 132 },
  9: { x: 396, y: 132 },
  10: { x: 244, y: 235 },
  11: { x: 396, y: 235 },
  12: { x: 150, y: 136 },
  13: { x: 150, y: 194 },
  14: { x: 121, y: 165 },
  15: { x: 179, y: 165 },
  16: { x: 320, y: 237 },
  17: { x: 320, y: 147 }
};

const XBOX_BUTTON_POINTS: Partial<Record<number, DiagramPoint>> = {
  0: { x: 490, y: 189 },
  1: { x: 520, y: 159 },
  2: { x: 460, y: 159 },
  3: { x: 490, y: 129 },
  4: { x: 183, y: 80 },
  5: { x: 457, y: 80 },
  6: { x: 183, y: 43 },
  7: { x: 457, y: 43 },
  8: { x: 280, y: 157 },
  9: { x: 360, y: 157 },
  10: { x: 188, y: 153 },
  11: { x: 389, y: 244 },
  12: { x: 251, y: 210 },
  13: { x: 251, y: 268 },
  14: { x: 222, y: 239 },
  15: { x: 280, y: 239 },
  16: { x: 320, y: 111 },
  17: { x: 320, y: 195 }
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

function DiagramMarkers({
  entries,
  points
}: {
  entries: ControllerDiagramEntry[];
  points: Partial<Record<number, DiagramPoint>>;
}) {
  return entries.map(({ action, marker, buttonIndex }) => {
    const point = points[buttonIndex];
    if (!point) return null;
    return (
      <g key={action} transform={`translate(${point.x} ${point.y})`}>
        <circle className={styles.controllerMarkerHalo} r="18.5" />
        <g transform="translate(12 -12)">
          <circle className={styles.controllerMarker} r="10.5" />
          <text className={styles.controllerMarkerText} textAnchor="middle" dy="0.36em">
            {marker}
          </text>
        </g>
      </g>
    );
  });
}

function DualShock4Diagram({ entries }: { entries: ControllerDiagramEntry[] }) {
  return (
    <svg viewBox="0 0 640 380" role="img" aria-label="DualShock 4 button layout">
      <ellipse className={styles.controllerShadow} cx="320" cy="335" rx="254" ry="21" />

      <path
        className={styles.controllerTrigger}
        d="M142 67 151 30c3-12 12-19 25-19h14c13 0 22 7 25 19l7 37Z"
      />
      <path
        className={styles.controllerTrigger}
        d="m498 67-9-37c-3-12-12-19-25-19h-14c-13 0-22 7-25 19l-7 37Z"
      />
      <path
        className={styles.controllerShoulderButton}
        d="M126 88c8-25 26-38 53-38h12c23 0 39 10 50 31l-9 25H135Z"
      />
      <path
        className={styles.controllerShoulderButton}
        d="M514 88c-8-25-26-38-53-38h-12c-23 0-39 10-50 31l9 25h97Z"
      />

      <path
        className={styles.controllerBody}
        d="M168 83c-35-2-62 9-80 32-22 28-30 70-40 120l-9 50c-7 36 9 63 36 70 26 7 49-8 66-37l36-58c14 23 34 39 62 47 52 15 110 15 162 0 28-8 48-24 62-47l36 58c17 29 40 44 66 37 27-7 43-34 36-70l-9-50c-10-50-18-92-40-120-18-23-45-34-80-32-35 2-59 15-80 31H248c-21-16-45-29-80-31Z"
      />
      <path
        className={styles.controllerBodyHighlight}
        d="M89 145c14-37 38-50 72-50 34 0 57 12 80 30h158c23-18 46-30 80-30 34 0 58 13 72 50"
      />
      <path
        className={styles.controllerGripSeam}
        d="M116 249c18-35 39-55 68-69M524 249c-18-35-39-55-68-69"
      />

      <rect
        className={styles.controllerTouchpad}
        x="236"
        y="108"
        width="168"
        height="80"
        rx="12"
      />
      <g className={styles.controllerTouchpadTexture}>
        <path d="M253 128h134M253 139h134M253 150h134M253 161h134M253 172h134" />
      </g>
      <path className={styles.controllerLightBar} d="M272 111h96" />

      <rect
        className={styles.controllerUtilityButton}
        x="229"
        y="122"
        width="14"
        height="30"
        rx="7"
        transform="rotate(-8 236 137)"
      />
      <rect
        className={styles.controllerUtilityButton}
        x="397"
        y="122"
        width="14"
        height="30"
        rx="7"
        transform="rotate(8 404 137)"
      />
      <path className={styles.controllerUtilityGlyph} d="M233 136h7M401 132h7M401 138h7" />

      <circle className={styles.controllerRecess} cx="150" cy="165" r="55" />
      <path className={styles.controllerDpad} d="m134 151 2-23q14-9 28 0l2 23-16 13Z" />
      <path className={styles.controllerDpad} d="m134 179 16-13 16 13-2 23q-14 9-28 0Z" />
      <path className={styles.controllerDpad} d="m136 151 13 14-13 14-23-2q-9-12 0-24Z" />
      <path className={styles.controllerDpad} d="m164 151-13 14 13 14 23-2q9-12 0-24Z" />
      <path
        className={styles.controllerDpadDetail}
        d="m143 137 7-7 7 7M143 193l7 7 7-7M122 158l-7 7 7 7M178 158l7 7-7 7"
      />

      <circle className={styles.controllerRecess} cx="493" cy="165" r="55" />
      <circle className={styles.controllerFaceButton} cx="493" cy="135" r="16" />
      <circle className={styles.controllerFaceButton} cx="523" cy="165" r="16" />
      <circle className={styles.controllerFaceButton} cx="493" cy="195" r="16" />
      <circle className={styles.controllerFaceButton} cx="463" cy="165" r="16" />
      <path
        className={`${styles.controllerFaceGlyph} ${styles.dualshockTriangle}`}
        d="m493 128 7 12h-14Z"
      />
      <circle
        className={`${styles.controllerFaceGlyph} ${styles.dualshockCircle}`}
        cx="523"
        cy="165"
        r="7"
      />
      <path
        className={`${styles.controllerFaceGlyph} ${styles.dualshockCross}`}
        d="m486 188 14 14m0-14-14 14"
      />
      <rect
        className={`${styles.controllerFaceGlyph} ${styles.dualshockSquare}`}
        x="456"
        y="158"
        width="14"
        height="14"
      />

      <g transform="translate(244 235)">
        <circle className={styles.controllerStickWell} r="35" />
        <circle className={styles.controllerStick} r="27" />
        <path className={styles.controllerStickDetail} d="M-16-4c10-6 22-6 32 0M-14 7c9 5 19 5 28 0" />
      </g>
      <g transform="translate(396 235)">
        <circle className={styles.controllerStickWell} r="35" />
        <circle className={styles.controllerStick} r="27" />
        <path className={styles.controllerStickDetail} d="M-16-4c10-6 22-6 32 0M-14 7c9 5 19 5 28 0" />
      </g>

      <g className={styles.controllerSpeaker}>
        <circle cx="305" cy="199" r="2" />
        <circle cx="313" cy="198" r="2" />
        <circle cx="321" cy="198" r="2" />
        <circle cx="329" cy="198" r="2" />
        <circle cx="337" cy="199" r="2" />
        <circle cx="309" cy="206" r="2" />
        <circle cx="317" cy="205" r="2" />
        <circle cx="325" cy="205" r="2" />
        <circle cx="333" cy="206" r="2" />
      </g>
      <circle className={styles.controllerHome} cx="320" cy="237" r="15" />
      <path className={styles.controllerHomeGlyph} d="M320 228v7m-7-2a10 10 0 1 0 14 0" />
      <rect className={styles.controllerPort} x="304" y="286" width="32" height="8" rx="4" />

      <DiagramMarkers entries={entries} points={DUALSHOCK_4_BUTTON_POINTS} />
    </svg>
  );
}

function XboxDiagram({ entries }: { entries: ControllerDiagramEntry[] }) {
  return (
    <svg viewBox="0 0 640 380" role="img" aria-label="Xbox controller button layout">
      <ellipse className={styles.controllerShadow} cx="320" cy="337" rx="256" ry="20" />

      <path
        className={styles.controllerTrigger}
        d="M137 68 148 27c3-11 12-17 23-17h24c12 0 21 7 24 19l7 39Z"
      />
      <path
        className={styles.controllerTrigger}
        d="m503 68-11-41c-3-11-12-17-23-17h-24c-12 0-21 7-24 19l-7 39Z"
      />
      <path
        className={styles.controllerShoulderButton}
        d="M119 88c9-26 31-39 65-39h16c25 0 43 10 58 30l-13 27H128Z"
      />
      <path
        className={styles.controllerShoulderButton}
        d="M521 88c-9-26-31-39-65-39h-16c-25 0-43 10-58 30l13 27h117Z"
      />

      <path
        className={styles.controllerBody}
        d="M155 79c-35 0-61 12-78 38-20 31-26 75-34 127l-7 44c-6 35 10 59 38 65 27 6 47-9 63-38l41-72c16 31 39 52 72 63 45 15 95 15 140 0 33-11 56-32 72-63l41 72c16 29 36 44 63 38 28-6 44-30 38-65l-7-44c-8-52-14-96-34-127-17-26-43-38-78-38-43 0-75 13-105 31-20-11-39-18-60-18s-40 7-60 18c-30-18-62-31-105-31Z"
      />
      <path
        className={styles.controllerBodyHighlight}
        d="M78 159c8-45 32-68 74-68 51 0 82 16 111 34 37-15 77-15 114 0 29-18 60-34 111-34 42 0 66 23 74 68"
      />
      <path
        className={styles.controllerGripSeam}
        d="M108 246c21-38 44-57 76-68M532 246c-21-38-44-57-76-68"
      />
      <path className={styles.controllerPanelSeam} d="M262 125c37-15 79-15 116 0M320 84v18" />

      <g transform="translate(188 153)">
        <circle className={styles.controllerStickWell} r="40" />
        <circle className={styles.controllerStick} r="29" />
        <path className={styles.controllerStickDetail} d="M-18-5c11-6 25-6 36 0M-16 8c10 5 22 5 32 0" />
      </g>

      <g transform="translate(251 239)">
        <circle className={styles.xboxDpadWell} r="43" />
        <path
          className={styles.xboxDpad}
          d="m-12-35 12-4 12 4 5 18 18 5L39 0l-4 12-18 5-5 18-12 4-12-4-5-18-18-5L-39 0l4-12 18-5Z"
        />
        <path
          className={styles.controllerDpadDetail}
          d="M0-30V30M-30 0h60M-27-27l10 10m34 34 10 10m0-54L17-17m-34 34-10 10"
        />
      </g>

      <g transform="translate(389 244)">
        <circle className={styles.controllerStickWell} r="40" />
        <circle className={styles.controllerStick} r="29" />
        <path className={styles.controllerStickDetail} d="M-18-5c11-6 25-6 36 0M-16 8c10 5 22 5 32 0" />
      </g>

      <circle className={styles.controllerFaceButton} cx="490" cy="129" r="16" />
      <circle className={styles.controllerFaceButton} cx="520" cy="159" r="16" />
      <circle className={styles.controllerFaceButton} cx="490" cy="189" r="16" />
      <circle className={styles.controllerFaceButton} cx="460" cy="159" r="16" />
      <text className={`${styles.xboxFaceGlyph} ${styles.xboxY}`} x="490" y="135" textAnchor="middle">Y</text>
      <text className={`${styles.xboxFaceGlyph} ${styles.xboxB}`} x="520" y="165" textAnchor="middle">B</text>
      <text className={`${styles.xboxFaceGlyph} ${styles.xboxA}`} x="490" y="195" textAnchor="middle">A</text>
      <text className={`${styles.xboxFaceGlyph} ${styles.xboxX}`} x="460" y="165" textAnchor="middle">X</text>

      <circle className={styles.xboxHome} cx="320" cy="111" r="24" />
      <path className={styles.xboxHomeGlyph} d="M308 99c8 3 16 10 24 24M332 99c-8 3-16 10-24 24M310 121c7-7 13-7 20 0" />

      <circle className={styles.controllerUtilityButton} cx="280" cy="157" r="13" />
      <path className={styles.controllerUtilityGlyph} d="M274 153h9v8h-9Zm3-3h9v8" />
      <circle className={styles.controllerUtilityButton} cx="360" cy="157" r="13" />
      <path className={styles.controllerUtilityGlyph} d="M356 153h8M356 157h8M356 161h8" />
      <rect
        className={styles.controllerUtilityButton}
        x="306"
        y="183"
        width="28"
        height="24"
        rx="10"
      />
      <path className={styles.controllerUtilityGlyph} d="M320 188v10m-4-4 4 4 4-4M314 201h12" />

      <rect className={styles.controllerPort} x="302" y="284" width="36" height="8" rx="4" />

      <DiagramMarkers entries={entries} points={XBOX_BUTTON_POINTS} />
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
      <DiagramMarkers entries={entries} points={GENERIC_BUTTON_POINTS} />
    </svg>
  );
}

export function ControllerDiagram({
  family,
  entries
}: {
  family: ControllerFamily;
  entries: ControllerDiagramEntry[];
}) {
  switch (family) {
    case 'playstation':
      return <DualShock4Diagram entries={entries} />;
    case 'xbox':
      return <XboxDiagram entries={entries} />;
    default:
      return <GenericControllerDiagram entries={entries} />;
  }
}
