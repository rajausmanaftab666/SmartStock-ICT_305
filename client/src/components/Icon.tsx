/**
 * The stroke icon set from the approved prototype. 18px, 1.6 stroke weight,
 * `currentColor` so an icon always matches the text beside it.
 */
export const ICON_PATHS = {
  dashboard: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z',
  users:
    'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19v-1a4 4 0 0 0-3-3.9M16 4.6a3 3 0 0 1 0 5.8',
  box: 'M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Zm0 18V12M3 7.5 12 12l9-4.5',
  truck:
    'M3 16V6h11v10M14 10h4l3 3v3h-7M6.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  doc: 'M6 3h8l4 4v14H6V3Zm8 0v5h4M9.5 12h6M9.5 16h4',
  alert: 'M12 4 3 20h18L12 4Zm0 6v5m0 3v.01',
  plus: 'M12 5v14M5 12h14',
  chart: 'M4 20V10m5 10V4m5 16v-7m5 7V8',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13a7.6 7.6 0 0 0 0-2l2-1.4-2-3.4-2.3 1a7.4 7.4 0 0 0-1.8-1L14.9 3h-3.8l-.4 2.6a7.4 7.4 0 0 0-1.8 1l-2.3-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.4 2 3.4 2.3-1a7.4 7.4 0 0 0 1.8 1l.4 2.6h3.8l.4-2.6a7.4 7.4 0 0 0 1.8-1l2.3 1 2-3.4-2-1.4Z',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 20a2 2 0 0 1-3.4 0',
  inbox: 'M3 13h5l1.5 2.5h5L16 13h5M5 5h14l2 8v6H3v-6l2-8Z',
  lock: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5V11Z',
} as const;

export type IconName = keyof typeof ICON_PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 18, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
