import { GameHeader } from "@/components/ui/GameHeader";
import { PopTimer } from "./PopTimer";

export { GameHeader as PopGameHeader };
export type { GameHeaderProps as PopGameHeaderProps } from "@/components/ui/GameHeader";

export function PopGameTimer({
  duration,
  active,
  onTimeUp,
  resetKey,
}: {
  duration: number;
  active: boolean;
  onTimeUp: () => void;
  resetKey: string | number;
}) {
  return (
    <PopTimer
      duration={duration}
      active={active}
      onTimeUp={onTimeUp}
      resetKey={resetKey}
      size="compact"
    />
  );
}
