import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const baseProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export function BoltIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M13 2 3 14h8l-1 8 11-13h-8V2Z" />
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 5v14M18 13l-6 6-6-6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

export function CrossIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m7 7 10 10M17 7 7 17" />
    </svg>
  );
}

export function CrownIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m3 7 4.2 4L12 4l4.8 7L21 7l-2 11H5L3 7Z" />
      <path d="M5 18h14M7 14h10" />
    </svg>
  );
}

export function QueensCrownIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} viewBox="0 0 64 64">
      <defs>
        <linearGradient id="queens-crown-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe37a" />
          <stop offset="0.55" stopColor="#f5c84b" />
          <stop offset="1" stopColor="#d99225" />
        </linearGradient>
        <linearGradient id="queens-crown-band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff0a6" />
          <stop offset="1" stopColor="#f5c84b" />
        </linearGradient>
        <radialGradient id="queens-crown-red" cx="30%" cy="25%" r="80%">
          <stop offset="0" stopColor="#ff9b9c" />
          <stop offset="1" stopColor="#e84e67" />
        </radialGradient>
        <radialGradient id="queens-crown-blue" cx="30%" cy="25%" r="80%">
          <stop offset="0" stopColor="#a4e2ff" />
          <stop offset="1" stopColor="#3c9ed0" />
        </radialGradient>
        <radialGradient id="queens-crown-purple" cx="30%" cy="25%" r="80%">
          <stop offset="0" stopColor="#c7adff" />
          <stop offset="1" stopColor="#7956c9" />
        </radialGradient>
      </defs>
      <path
        fill="url(#queens-crown-gold)"
        d="M8.5 18.5 16.5 23 23 11l5.4 10 3.6-15 3.6 15 5.4-10 6.5 12 8-4.5-2.35 22.4A7 7 0 0 1 46.65 48H17.35a7 7 0 0 1-6.95-6.1L8.5 18.5Z"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        fill="url(#queens-crown-band)"
        d="M11.7 37.4h40.6l-.55 5.1A6.2 6.2 0 0 1 45.6 48H18.4a6.2 6.2 0 0 1-6.15-5.5l-.55-5.1Z"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        fill="#d99225"
        d="M16.5 47.5h31c1.65 0 3 1.35 3 3V53H13.5v-2.5c0-1.65 1.35-3 3-3Z"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M14.5 29c9.5 3.8 25.5 3.8 35 0"
        fill="none"
        stroke="#fff5c4"
        strokeWidth="2.2"
        opacity="0.9"
      />
      <circle cx="8.5" cy="18.5" r="2.35" fill="#ffb82e" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="23" cy="11" r="2.35" fill="#ffb82e" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="6" r="2.45" fill="#ffb82e" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="41" cy="11" r="2.35" fill="#ffb82e" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="55.5" cy="18.5" r="2.35" fill="#ffb82e" stroke="currentColor" strokeWidth="1.5" />
      <circle
        cx="20.5"
        cy="29"
        r="3.15"
        fill="url(#queens-crown-red)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="32"
        cy="23.5"
        r="3.15"
        fill="url(#queens-crown-blue)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="43.5"
        cy="29"
        r="3.15"
        fill="url(#queens-crown-purple)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M16 33.2c8.8 2.6 23.2 2.6 32 0"
        fill="none"
        stroke="#b9781d"
        strokeWidth="1.5"
        opacity="0.55"
      />
    </svg>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5M12 17h.01" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function NotebookIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V3Z" />
      <path d="M8 3v18M11 8h5M11 12h5M11 16h3M3 7h4M3 12h4M3 17h4" />
    </svg>
  );
}

export function RotateIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M20 7v5h-5" />
      <path d="M19 12a7 7 0 1 1-2-5" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8ZM10 20h4" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4L17 17.4a1.7 1.7 0 0 0-2.9 1.2V19a1.7 1.7 0 0 1-3.4 0v-.4a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1A1.7 1.7 0 0 0 6.2 12H6a1.7 1.7 0 0 1 0-3.4h.4A1.7 1.7 0 0 0 7.6 5.7l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1A1.7 1.7 0 0 0 12.9 2.2V2a1.7 1.7 0 0 1 3.4 0v.4a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1A1.7 1.7 0 0 0 20.4 9h.4a1.7 1.7 0 0 1 0 3.4h-.4a1.7 1.7 0 0 0-1 2.6Z" />
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M8 4h8v3c0 4-1.8 6-4 6s-4-2-4-6V4Zm4 9v4m-4 3h8M8 6H5v1c0 2 1.2 3.5 3.4 4M16 6h3v1c0 2-1.2 3.5-3.4 4" />
    </svg>
  );
}

export function UndoIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-2" />
    </svg>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
