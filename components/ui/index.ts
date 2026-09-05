export { Button, ButtonLink } from "./Button";
export type { ButtonLinkProps, ButtonProps } from "./Button";
export { Chip } from "./Chip";
export type { ChipProps } from "./Chip";
export { MotionButton } from "./MotionButton.client";
export type { MotionButtonProps } from "./MotionButton.client";
export { Badge } from "./Badge";
export { AppHeader } from "./AppHeader";
export { GameHeader } from "./GameHeader";
export type { AppHeaderProps } from "./AppHeader";
export type { GameHeaderProps } from "./GameHeader";
export { LegacyTheme } from "./LegacyTheme";

// Transitional aliases. All callers still resolve to one implementation.
export {
  PopAvatar as Avatar,
  PopAvatarStack as AvatarStack,
} from "@/components/flash-pop/ui/PopAvatar";
export { PopAvatar, PopAvatarStack } from "@/components/flash-pop/ui/PopAvatar";
export { PopCard as Card } from "@/components/flash-pop/ui/PopCard";
export { PopCard } from "@/components/flash-pop/ui/PopCard";
export { PopCanvas as Canvas } from "@/components/flash-pop/ui/PopCanvas";
export { PopCanvas } from "@/components/flash-pop/ui/PopCanvas";
export { PopIconButton as IconButton } from "@/components/flash-pop/ui/PopIconButton";
export { PopIconButton } from "@/components/flash-pop/ui/PopIconButton";
export {
  PopTimer as Timer,
  PopTimerDisplay as TimerDisplay,
} from "@/components/flash-pop/ui/PopTimer";
export { PopTimer, PopTimerDisplay } from "@/components/flash-pop/ui/PopTimer";
export { PopGameTimer as GameTimer } from "@/components/flash-pop/ui/PopGameHeader";
export { PopGameHeader } from "@/components/flash-pop/ui/PopGameHeader";
export type {
  PopAvatarData,
  PopAvatarData as AvatarData,
  PopAvatarProps as AvatarProps,
  PopAvatarSize as AvatarSize,
  PopAvatarStackProps as AvatarStackProps,
  PopAvatarTone as AvatarTone,
} from "@/components/flash-pop/ui/PopAvatar";
export type {
  PopAvatarProps,
  PopAvatarSize,
  PopAvatarStackProps,
  PopAvatarTone,
} from "@/components/flash-pop/ui/PopAvatar";
export type { PopCardProps as CardProps } from "@/components/flash-pop/ui/PopCard";
export type { PopCanvasProps as CanvasProps } from "@/components/flash-pop/ui/PopCanvas";
export type { PopIconButtonProps as IconButtonProps } from "@/components/flash-pop/ui/PopIconButton";
export type {
  PopTimerDisplayProps as TimerDisplayProps,
  PopTimerProps as TimerProps,
} from "@/components/flash-pop/ui/PopTimer";

export { Button as PopButton, ButtonLink as PopButtonLink } from "./Button";
export type {
  ButtonLinkProps as PopButtonLinkProps,
  ButtonProps as PopButtonProps,
} from "./Button";
export { Chip as PopChip } from "./Chip";
export type { ChipProps as PopChipProps } from "./Chip";
