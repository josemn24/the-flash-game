import dynamic from "next/dynamic";
import type { Challenge, GameRoomContext } from "@/types/game";
import type { ChallengeCompletionResult } from "@/types/game";

type GameAppProps = {
  challenge: Challenge;
  roomContext?: GameRoomContext;
  onComplete?: (result: ChallengeCompletionResult) => void;
};

const FlashPopAlphabetGame = dynamic(() =>
  import("@/components/game/modes/flash-pop/FlashPopAlphabetGame.client").then(
    (module) => module.FlashPopAlphabetGame,
  ),
);
const FlashGameApp = dynamic(() =>
  import("@/components/game/shells/FlashGameApp.client").then((module) => module.FlashGameApp),
);
const FlashPopFlashGame = dynamic(() =>
  import("@/components/game/modes/flash-pop/FlashPopFlashGame.client").then(
    (module) => module.FlashPopFlashGame,
  ),
);
const FlashPopPyramidGame = dynamic(() =>
  import("@/components/game/modes/flash-pop/FlashPopPyramidGame.client").then(
    (module) => module.FlashPopPyramidGame,
  ),
);
const FlashPopSurvivalGame = dynamic(() =>
  import("@/components/game/modes/flash-pop/FlashPopSurvivalGame.client").then(
    (module) => module.FlashPopSurvivalGame,
  ),
);
const NarrativeGameApp = dynamic(() =>
  import("@/components/game/modes/narrative/NarrativeGameApp.client").then(
    (module) => module.NarrativeGameApp,
  ),
);

export function GameApp({ challenge, roomContext, onComplete }: GameAppProps) {
  if (challenge.mode === "alphabet") {
    return <FlashPopAlphabetGame challenge={challenge} roomContext={roomContext} onComplete={onComplete} />;
  }
  if (challenge.mode === "narrative") {
    return <NarrativeGameApp challenge={challenge} roomContext={roomContext} onComplete={onComplete} />;
  }
  if (challenge.mode === "pyramid") {
    return <FlashPopPyramidGame challenge={challenge} roomContext={roomContext} onComplete={onComplete} />;
  }
  if (challenge.mode === "survival") {
    return <FlashPopSurvivalGame challenge={challenge} roomContext={roomContext} onComplete={onComplete} />;
  }
  if (challenge.mode === "flash") {
    return <FlashPopFlashGame challenge={challenge} roomContext={roomContext} onComplete={onComplete} />;
  }
  return <FlashGameApp challenge={challenge} />;
}
