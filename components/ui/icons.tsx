import type { SVGProps } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bell,
  Check,
  ChevronRight,
  Clock,
  Crown,
  Eye,
  Heart,
  Lock,
  Notebook,
  RotateCcw,
  Settings,
  TriangleAlert,
  Trophy,
  Undo2,
  X,
} from "lucide-react";

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
  return <ArrowRight {...baseProps} {...props} />;
}

export function ArrowUpIcon(props: IconProps) {
  return <ArrowUp {...baseProps} {...props} />;
}

export function ArrowDownIcon(props: IconProps) {
  return <ArrowDown {...baseProps} {...props} />;
}

export function CheckIcon(props: IconProps) {
  return <Check {...baseProps} {...props} />;
}

export function CrossIcon(props: IconProps) {
  return <X {...baseProps} {...props} />;
}

export function CrownIcon(props: IconProps) {
  return <Crown {...baseProps} {...props} />;
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
  return <TriangleAlert {...baseProps} {...props} />;
}

export function LockIcon(props: IconProps) {
  return <Lock {...baseProps} {...props} />;
}

export function ClockIcon(props: IconProps) {
  return <Clock {...baseProps} {...props} />;
}

export function HeartIcon(props: IconProps) {
  return <Heart {...baseProps} {...props} />;
}

export function EyeIcon(props: IconProps) {
  return <Eye {...baseProps} {...props} />;
}

export function NotebookIcon(props: IconProps) {
  return <Notebook {...baseProps} {...props} />;
}

export function RotateIcon(props: IconProps) {
  return <RotateCcw {...baseProps} {...props} />;
}

export function BellIcon(props: IconProps) {
  return <Bell {...baseProps} {...props} />;
}

export function SettingsIcon(props: IconProps) {
  return <Settings {...baseProps} {...props} />;
}

export function TrophyIcon(props: IconProps) {
  return <Trophy {...baseProps} {...props} />;
}

export function UndoIcon(props: IconProps) {
  return <Undo2 {...baseProps} {...props} />;
}

export function ChevronIcon(props: IconProps) {
  return <ChevronRight {...baseProps} {...props} />;
}
