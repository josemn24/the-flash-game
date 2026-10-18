import dynamic from "next/dynamic";
import type { MockGameAppProps } from "./gameAppTypes";
import { localAlphabetDefinitionFromChallenge } from "@/features/alphabet/localAlphabetDefinition";

const Flash = dynamic(() =>
  import("@/components/game/modes/flash-pop/FlashPopFlashGame.client").then(
    (m) => m.FlashPopFlashGame,
  ),
);
const Alphabet = dynamic(() =>
  import("@/components/game/shells/LocalAlphabetGameApp.client").then(
    (m) => m.LocalAlphabetGameApp,
  ),
);
const Survival = dynamic(() =>
  import("@/components/game/modes/flash-pop/FlashPopSurvivalGame.client").then(
    (m) => m.FlashPopSurvivalGame,
  ),
);
const Pyramid = dynamic(() =>
  import("@/components/game/modes/flash-pop/FlashPopPyramidGame.client").then(
    (m) => m.FlashPopPyramidGame,
  ),
);
const Narrative = dynamic(() =>
  import("@/components/game/modes/narrative/NarrativeGameApp.client").then(
    (m) => m.NarrativeGameApp,
  ),
);

export function MockGameApp({ challenge, onComplete, socialSnapshot }: MockGameAppProps) {
  switch (challenge.mode) {
    case "flash":
      return <Flash challenge={challenge} onComplete={onComplete} />;
    case "alphabet":
      return (
        <Alphabet definition={localAlphabetDefinitionFromChallenge(challenge)} onComplete={onComplete} />
      );
    case "survival":
      return (
        <Survival challenge={challenge} onComplete={onComplete} socialSnapshot={socialSnapshot} />
      );
    case "pyramid":
      return (
        <Pyramid challenge={challenge} onComplete={onComplete} socialSnapshot={socialSnapshot} />
      );
    case "narrative":
      return <Narrative challenge={challenge} onComplete={onComplete} />;
    default:
      return unreachable(challenge);
  }
}

function unreachable(challenge: never): never {
  throw new Error(`Unsupported local challenge: ${JSON.stringify(challenge)}`);
}
