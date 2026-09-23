import dynamic from "next/dynamic";
import type { Challenge, GameRoomContext } from "@/types/game";
import type {
  ServerAlphabetChallenge,
  ServerFlashChallenge,
  ServerFlashTerminalReview,
  ServerSurvivalChallenge,
  ServerPyramidChallenge,
} from "@/types/gameplay/challenge";
import type { ChallengeCompletionResult } from "@/types/game";
import type { FlashPopSocialSnapshot } from "@/types/view-models";
import type { GameplayPersistence } from "@/types/view-models";

type GameAppProps = {
  challenge:
    | Challenge
    | ServerFlashChallenge
    | ServerAlphabetChallenge
    | ServerSurvivalChallenge
    | ServerPyramidChallenge;
  roomContext?: GameRoomContext;
  onComplete?: (result: ChallengeCompletionResult) => void;
  socialSnapshot: FlashPopSocialSnapshot;
  persistence?: GameplayPersistence;
  terminalReview?: readonly ServerFlashTerminalReview[];
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
const ServerFlashPopGame = dynamic(() =>
  import("@/components/game/modes/flash-pop/ServerFlashPopGame.client").then(
    (module) => module.ServerFlashPopGame,
  ),
);
const ServerFlashPopAlphabetGame = dynamic(() =>
  import("@/components/game/modes/flash-pop/ServerFlashPopAlphabetGame.client").then(
    (module) => module.ServerFlashPopAlphabetGame,
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
const ServerFlashPopSurvivalGame = dynamic(() =>
  import("@/components/game/modes/flash-pop/ServerFlashPopSurvivalGame.client").then(
    (module) => module.ServerFlashPopSurvivalGame,
  ),
);
const ServerFlashPopPyramidGame = dynamic(() =>
  import("@/components/game/modes/flash-pop/ServerFlashPopPyramidGame.client").then(
    (module) => module.ServerFlashPopPyramidGame,
  ),
);
const NarrativeGameApp = dynamic(() =>
  import("@/components/game/modes/narrative/NarrativeGameApp.client").then(
    (module) => module.NarrativeGameApp,
  ),
);

export function GameApp({
  challenge,
  roomContext,
  onComplete,
  socialSnapshot,
  persistence = "mock",
  terminalReview,
}: GameAppProps) {
  if (challenge.mode === "alphabet") {
    if (persistence === "server" && roomContext && "timeLimitMs" in challenge) {
      return (
        <ServerFlashPopAlphabetGame
          challenge={challenge}
          roomContext={roomContext}
          terminalReview={terminalReview}
        />
      );
    }
    return (
      <FlashPopAlphabetGame
        challenge={challenge as Extract<Challenge, { mode: "alphabet" }>}
        roomContext={roomContext}
        onComplete={onComplete}
      />
    );
  }
  if (challenge.mode === "narrative") {
    return (
      <NarrativeGameApp challenge={challenge} roomContext={roomContext} onComplete={onComplete} />
    );
  }
  if (challenge.mode === "pyramid") {
    if (persistence === "server" && roomContext && "maxScore" in challenge) {
      return (
        <ServerFlashPopPyramidGame
          challenge={challenge}
          roomContext={roomContext}
          terminalReview={terminalReview}
        />
      );
    }
    return (
      <FlashPopPyramidGame
        challenge={challenge as Extract<Challenge, { mode: "pyramid" }>}
        roomContext={roomContext}
        onComplete={onComplete}
        socialSnapshot={socialSnapshot}
      />
    );
  }
  if (challenge.mode === "survival") {
    if (persistence === "server" && roomContext && "slots" in challenge) {
      return (
        <ServerFlashPopSurvivalGame
          challenge={challenge}
          roomContext={roomContext}
          terminalReview={terminalReview}
        />
      );
    }
    return (
      <FlashPopSurvivalGame
        challenge={challenge as Extract<Challenge, { mode: "survival" }>}
        roomContext={roomContext}
        onComplete={onComplete}
        socialSnapshot={socialSnapshot}
      />
    );
  }
  if (challenge.mode === "flash") {
    if (persistence === "server" && roomContext && "slots" in challenge) {
      return (
        <ServerFlashPopGame
          challenge={challenge}
          roomContext={roomContext}
          terminalReview={terminalReview}
        />
      );
    }
    if ("slots" in challenge) return null;
    return (
      <FlashPopFlashGame challenge={challenge} roomContext={roomContext} onComplete={onComplete} />
    );
  }
  return <FlashGameApp challenge={challenge} roomContext={roomContext} />;
}
