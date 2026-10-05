import dynamic from "next/dynamic";
import type { Challenge } from "@/types/gameplay";
import type {
  ServerAlphabetChallenge,
  ServerFlashChallenge,
  ServerFlashTerminalReview,
  ServerNarrativeChallenge,
  ServerSurvivalChallenge,
  ServerPyramidChallenge,
} from "@/types/gameplay/challenge";
import type { ChallengeCompletionResult } from "@/types/gameplay";
import type { FlashPopSocialSnapshot } from "@/types/view-models";
import type { GameplayPersistence } from "@/types/view-models";
import type { GameRoomContext } from "@/types/view-models/room";

type GameAppProps = {
  challenge:
    | Challenge
    | ServerFlashChallenge
    | ServerAlphabetChallenge
    | ServerSurvivalChallenge
    | ServerPyramidChallenge
    | ServerNarrativeChallenge;
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
const ServerNarrativeGame = dynamic(() =>
  import("@/components/game/modes/narrative/ServerNarrativeGame.client").then(
    (module) => module.ServerNarrativeGame,
  ),
);

function CompetitiveChallengeUnavailable({ mode }: { mode: string }) {
  return (
    <section role="alert" className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1>Desafío no disponible</h1>
      <p className="mt-3 text-[var(--ds-color-fg-secondary)]">
        El modo {mode} todavía no tiene una proyección competitiva server válida.
      </p>
    </section>
  );
}

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
    if (persistence === "server" && roomContext && "slots" in challenge) {
      return (
        <ServerNarrativeGame
          challenge={challenge}
          roomContext={roomContext}
          terminalReview={terminalReview}
        />
      );
    }
    if (persistence === "server" && roomContext) {
      return <CompetitiveChallengeUnavailable mode="narrative" />;
    }
    return (
      <NarrativeGameApp
        challenge={challenge as Extract<Challenge, { mode: "narrative" }>}
        roomContext={roomContext}
        onComplete={onComplete}
      />
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
