export type IconName =
  | 'add'
  | 'arrivals'
  | 'arrow-right'
  | 'booking'
  | 'calendar'
  | 'care'
  | 'chart'
  | 'check'
  | 'clipboard'
  | 'departures'
  | 'filter'
  | 'home'
  | 'logout'
  | 'money'
  | 'pets'
  | 'refresh'
  | 'settings'
  | 'shield'
  | 'users'
  | 'website';

type IconSize = 'sm' | 'md' | 'lg';

export type IconProps = {
  className?: string;
  label?: string;
  name: IconName;
  size?: IconSize;
};

const paths: Record<IconName, string> = {
  add: 'M12 5v14M5 12h14',
  arrivals: 'M4 12h12m-4-4 4 4-4 4m7-11v14',
  'arrow-right': 'M5 12h14m-5-5 5 5-5 5',
  booking: 'M7 3v4m10-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm4 9 2 2 4-5',
  calendar:
    'M6 3v3m12-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm3 7h3m2 0h3m-8 4h3m2 0h3',
  care: 'M12 21s-8-4.5-8-11a4 4 0 0 1 7-2.6A4 4 0 0 1 18 10c0 6.5-6 11-6 11Zm0-10v5m-2.5-2.5h5',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  check: 'm5 12 4 4L19 6',
  clipboard: 'M9 5h6m-5-2h4a1 1 0 0 1 1 1v2H9V4a1 1 0 0 1 1-1ZM7 5H5v16h14V5h-2m-8 6h6m-6 4h6',
  departures: 'M20 12H8m4-4-4 4 4 4M5 5v14',
  filter: 'M4 5h16l-6 7v5l-4 2v-7L4 5Z',
  home: 'M3 11.5 12 4l9 7.5M5.5 10v10h13V10M9 20v-6h6v6',
  logout: 'M10 17l5-5-5-5m5 5H3m12-8h5v16h-5',
  money: 'M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  pets: 'M8.5 11C5 11 3 13.5 4 16.5c1 3 4.5 4 8 1.5 3.5 2.5 7 1.5 8-1.5 1-3-1-5.5-4.5-5.5-2 0-2.2 1-3.5 1s-1.5-1-3.5-1ZM6 8.5A2 2 0 1 0 6 4.5a2 2 0 0 0 0 4Zm5-2A2 2 0 1 0 11 2.5a2 2 0 0 0 0 4Zm7 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  refresh: 'M20 7v5h-5M4 17v-5h5m10.2-3A8 8 0 0 0 5.4 7M4.8 15A8 8 0 0 0 18.6 17',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.5 1a8 8 0 0 0-1.7-1L14.7 3h-4l-.4 3a8 8 0 0 0-1.7 1L6 6 4 9.4 6 11a7 7 0 0 0 0 2l-2 1.6L6 18l2.6-1a8 8 0 0 0 1.7 1l.4 3h4l.4-3a8 8 0 0 0 1.7-1l2.5 1 2-3.4-2-1.6a7 7 0 0 0 .1-1Z',
  shield: 'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Zm-3-10 2 2 4-5',
  users:
    'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m6.5-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8.5 1a3 3 0 0 1 3 3v2m-5-10a3 3 0 0 1 0 6',
  website: 'M3 5h18v14H3V5Zm0 4h18M6 7h.01M9 7h.01',
};

const sizeStyles: Record<IconSize, string> = {
  lg: 'size-6',
  md: 'size-5',
  sm: 'size-[1.15rem]',
};

export function Icon({ className = '', label, name, size = 'md' }: IconProps) {
  return (
    <svg
      aria-hidden={label ? undefined : 'true'}
      aria-label={label}
      className={`${sizeStyles[size]} shrink-0 ${className}`}
      fill="none"
      role={label ? 'img' : undefined}
      viewBox="0 0 24 24"
    >
      <path
        d={paths[name]}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
