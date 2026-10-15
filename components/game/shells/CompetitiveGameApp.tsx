import dynamic from "next/dynamic";
import type { CompetitiveGameAppProps } from "./gameAppTypes";

const Flash = dynamic(() =>
  import("@/components/game/modes/flash-pop/ServerFlashPopGame.client").then(
    (m) => m.ServerFlashPopGame,
  ),
);
const Alphabet = dynamic(() =>
  import("@/components/game/modes/flash-pop/ServerFlashPopAlphabetGame.client").then(
    (m) => m.ServerFlashPopAlphabetGame,
  ),
);
const Survival = dynamic(() =>
  import("@/components/game/modes/flash-pop/ServerFlashPopSurvivalGame.client").then(
    (m) => m.ServerFlashPopSurvivalGame,
  ),
);
const Pyramid = dynamic(() =>
  import("@/components/game/modes/flash-pop/ServerFlashPopPyramidGame.client").then(
    (m) => m.ServerFlashPopPyramidGame,
  ),
);
const Narrative = dynamic(() =>
  import("@/components/game/modes/narrative/ServerNarrativeGame.client").then(
    (m) => m.ServerNarrativeGame,
  ),
);
const TimeTrial = dynamic(() =>
  import("@/components/game/modes/flash-pop/ServerFlashPopTimeTrialGame.client").then(
    (m) => m.ServerFlashPopTimeTrialGame,
  ),
);

export function CompetitiveGameApp({
  challenge,
  roomContext,
  terminalReview,
}: CompetitiveGameAppProps) {
  const context = { roomContext, terminalReview };
  switch (challenge.mode) {
    case "flash":
      return <Flash {...context} challenge={challenge} />;
    case "alphabet":
      return <Alphabet {...context} challenge={challenge} />;
    case "survival":
      return <Survival {...context} challenge={challenge} />;
    case "pyramid":
      return <Pyramid {...context} challenge={challenge} />;
    case "narrative":
      return <Narrative {...context} challenge={challenge} />;
    case "time-trial":
      return <TimeTrial {...context} challenge={challenge} />;
    default:
      return unreachable(challenge);
  }
}

function unreachable(challenge: never): never {
  throw new Error(`Unsupported competitive challenge: ${JSON.stringify(challenge)}`);
}
