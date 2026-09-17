import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'back'
  | 'download'
  | 'edit'
  | 'gamepad'
  | 'help'
  | 'list'
  | 'more'
  | 'nextSection'
  | 'pause'
  | 'play'
  | 'plus'
  | 'previousSection'
  | 'reset'
  | 'search'
  | 'settings'
  | 'upload';

/**
 * Sistema de íconos Telón: vectores en retícula de 24 con área viva de 20,
 * trazo de 2 px en todo, remates cuadrados, esquinas en inglete y diagonales
 * a 45°. Los macizos se limitan a detalles pequeños (puntos, puntas, dientes).
 * Las coordenadas son enteras para que el trazo caiga en píxeles exactos a 24 px.
 */
function Block({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return <rect x={x} y={y} width={width} height={height} fill="currentColor" stroke="none" />;
}

const paths: Record<IconName, ReactNode> = {
  back: <path d="M15 5L8 12L15 19" />,
  download: <path d="M12 3V16M7 11L12 16L17 11M4 21H20" />,
  edit: (
    <>
      <path d="M4 20V16L15 5L19 9L8 20ZM12 8L16 12M13 20H20" />
      <path d="M4 20V17L7 20ZM15 5L19 9L16 12L12 8Z" fill="currentColor" stroke="none" />
    </>
  ),
  gamepad: (
    <>
      <path d="M2 7H22V19H15V17H9V19H2ZM5 13H9M7 11V15" />
      <Block x={16} y={9} width={2} height={2} />
      <Block x={14} y={11} width={2} height={2} />
      <Block x={18} y={11} width={2} height={2} />
      <Block x={16} y={13} width={2} height={2} />
    </>
  ),
  help: (
    <>
      <path d="M7 8V4H17V12H12V15" />
      <Block x={11} y={18} width={2} height={2} />
    </>
  ),
  list: (
    <>
      <path d="M9 6H20M9 12H20M9 18H20" />
      <Block x={4} y={5} width={2} height={2} />
      <Block x={4} y={11} width={2} height={2} />
      <Block x={4} y={17} width={2} height={2} />
    </>
  ),
  more: (
    <>
      <Block x={3} y={10} width={4} height={4} />
      <Block x={10} y={10} width={4} height={4} />
      <Block x={17} y={10} width={4} height={4} />
    </>
  ),
  nextSection: <path d="M4 5L14 12L4 19ZM19 5V19" />,
  pause: <path d="M6 5H10V19H6ZM14 5H18V19H14Z" />,
  play: <path d="M7 4L19 12L7 20Z" />,
  plus: <path d="M12 4V20M4 12H20" />,
  previousSection: <path d="M20 5L10 12L20 19ZM5 5V19" />,
  reset: <path d="M5 5H19V19H5V11M8 2L5 5L8 8" />,
  search: <path d="M4 4H14V14H4ZM14 14L20 20" />,
  settings: (
    <>
      <path d="M8 5H16L19 8V16L16 19H8L5 16V8ZM10 10H14V14H10Z" />
      <Block x={10} y={2} width={4} height={3} />
      <Block x={10} y={19} width={4} height={3} />
      <Block x={2} y={10} width={3} height={4} />
      <Block x={19} y={10} width={3} height={4} />
    </>
  ),
  upload: <path d="M4 3H20M12 8V21M7 13L12 8L17 13" />
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
