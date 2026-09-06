import dynamic from "next/dynamic";
import type { Challenge } from "@/types/game";

const AlphabetGameApp = dynamic(() =>
  import("@/components/game/modes/alphabet/AlphabetGameApp.client").then(
    (module) => module.AlphabetGameApp,
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
const NarrativeGameApp = dynamic(() =>
  import("@/components/game/modes/narrative/NarrativeGameApp.client").then(
    (module) => module.NarrativeGameApp,
  ),
);
const SurvivalGameApp = dynamic(() =>
  import("@/components/game/shells/SurvivalGameApp.client").then(
    (module) => module.SurvivalGameApp,
  ),
);

export function GameApp({ challenge }: { challenge: Challenge }) {
  if (challenge.mode === "alphabet") {
    return <AlphabetGameApp challenge={challenge} />;
  }
  if (challenge.mode === "narrative") {
    return <NarrativeGameApp challenge={challenge} />;
  }
  if (challenge.mode === "pyramid") {
    return <FlashPopPyramidGame challenge={challenge} />;
  }
  if (challenge.mode === "survival") {
    return <SurvivalGameApp challenge={challenge} />;
  }
  if (challenge.mode === "flash") {
    return <FlashPopFlashGame challenge={challenge} />;
  }
  return <FlashGameApp challenge={challenge} />;
}
