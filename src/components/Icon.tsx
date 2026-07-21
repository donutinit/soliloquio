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

const paths: Record<IconName, ReactNode> = {
  back: <path d="m15 18-6-6 6-6" />,
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </>
  ),
  gamepad: (
    <>
      <path d="M7.5 9h-2A3.5 3.5 0 0 0 2 12.5v2A3.5 3.5 0 0 0 5.5 18c1.4 0 2.2-1 3-2h7c.8 1 1.6 2 3 2a3.5 3.5 0 0 0 3.5-3.5v-2A3.5 3.5 0 0 0 18.5 9h-2" />
      <path d="M8 13H5m1.5-1.5v3M16 12h.01M18 14h.01M9 6h6l1.5 3h-9Z" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.3 2.3 0 1 1 3.7 1.8c-.9.6-1.5 1-1.5 2.2" />
      <path d="M12 17h.01" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  nextSection: (
    <>
      <path d="M6 6v12" />
      <path d="m10 9 3 3-3 3" />
      <path d="M13 12h5" />
    </>
  ),
  pause: (
    <>
      <path d="M9 6v12" />
      <path d="M15 6v12" />
    </>
  ),
  play: <path d="m9 6 9 6-9 6Z" fill="currentColor" stroke="none" />,
  plus: <path d="M12 5v14M5 12h14" />,
  previousSection: (
    <>
      <path d="M18 6v12" />
      <path d="m14 9-3 3 3 3" />
      <path d="M11 12H6" />
    </>
  ),
  reset: (
    <>
      <path d="M4 4v6h6" />
      <path d="M5.5 15a8 8 0 1 0 1-8.5L4 10" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 5 5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  upload: (
    <>
      <path d="M12 21V9" />
      <path d="m7 14 5-5 5 5" />
      <path d="M5 3h14" />
    </>
  )
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
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
