import dynamic from "next/dynamic";
import type { Challenge } from "@/types/game";

const AlphabetGameApp = dynamic(() =>
  import("@/components/alphabet/AlphabetGameApp.client").then((module) => module.AlphabetGameApp),
);
const FlashGameApp = dynamic(() =>
  import("@/components/FlashGameApp.client").then((module) => module.FlashGameApp),
);

export function GameApp({ challenge }: { challenge: Challenge }) {
  return challenge.mode === "alphabet" ? (
    <AlphabetGameApp challenge={challenge} />
  ) : (
    <FlashGameApp challenge={challenge} />
  );
}
