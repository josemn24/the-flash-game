import dynamic from "next/dynamic";
import { PopTheme } from "@/components/flash-pop/PopTheme";
import { LegacyTheme } from "@/components/ui";
import { isFlashPopPreviewChallenge } from "@/features/flash-pop/demoSocial";
import type { Challenge } from "@/types/game";

const AlphabetGameApp = dynamic(() =>
  import("@/components/alphabet/AlphabetGameApp.client").then((module) => module.AlphabetGameApp),
);
const FlashGameApp = dynamic(() =>
  import("@/components/FlashGameApp.client").then((module) => module.FlashGameApp),
);
const FlashPopFlashGame = dynamic(() =>
  import("@/components/flash-pop/FlashPopFlashGame.client").then(
    (module) => module.FlashPopFlashGame,
  ),
);
const FlashPopPyramidGame = dynamic(() =>
  import("@/components/flash-pop/FlashPopPyramidGame.client").then(
    (module) => module.FlashPopPyramidGame,
  ),
);
const NarrativeGameApp = dynamic(() =>
  import("@/components/NarrativeGameApp.client").then((module) => module.NarrativeGameApp),
);
const PyramidGameApp = dynamic(() =>
  import("@/components/pyramid/PyramidGameApp.client").then((module) => module.PyramidGameApp),
);
const SurvivalGameApp = dynamic(() =>
  import("@/components/SurvivalGameApp.client").then((module) => module.SurvivalGameApp),
);

export function GameApp({ challenge }: { challenge: Challenge }) {
  if (challenge.mode === "alphabet") {
    return (
      <LegacyTheme>
        <AlphabetGameApp challenge={challenge} />
      </LegacyTheme>
    );
  }
  if (challenge.mode === "narrative") {
    return (
      <LegacyTheme>
        <NarrativeGameApp challenge={challenge} />
      </LegacyTheme>
    );
  }
  if (challenge.mode === "pyramid" && isFlashPopPreviewChallenge(challenge.id)) {
    return (
      <PopTheme>
        <FlashPopPyramidGame challenge={challenge} />
      </PopTheme>
    );
  }
  if (challenge.mode === "pyramid") {
    return (
      <LegacyTheme>
        <PyramidGameApp challenge={challenge} />
      </LegacyTheme>
    );
  }
  if (challenge.mode === "survival") {
    return (
      <LegacyTheme>
        <SurvivalGameApp challenge={challenge} />
      </LegacyTheme>
    );
  }
  if (challenge.mode === "flash") {
    return (
      <PopTheme>
        <FlashPopFlashGame challenge={challenge} />
      </PopTheme>
    );
  }
  return (
    <LegacyTheme>
      <FlashGameApp challenge={challenge} />
    </LegacyTheme>
  );
}
