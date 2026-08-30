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

export function WarningIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5M12 17h.01" />
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
