import dynamic from "next/dynamic";
import type { Challenge } from "@/types/game";

const AlphabetGameApp = dynamic(() =>
  import("@/components/alphabet/AlphabetGameApp.client").then((module) => module.AlphabetGameApp),
);
const FlashGameApp = dynamic(() =>
  import("@/components/FlashGameApp.client").then((module) => module.FlashGameApp),
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
  if (challenge.mode === "alphabet") return <AlphabetGameApp challenge={challenge} />;
  if (challenge.mode === "narrative") return <NarrativeGameApp challenge={challenge} />;
  if (challenge.mode === "pyramid") return <PyramidGameApp challenge={challenge} />;
  if (challenge.mode === "survival") return <SurvivalGameApp challenge={challenge} />;
  return <FlashGameApp challenge={challenge} />;
}
