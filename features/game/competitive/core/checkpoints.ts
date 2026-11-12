import type { GameSessionOperation } from "@/types/contracts/game-session";

export function isDraftCommand(operation: GameSessionOperation | undefined) {
  return (
    operation === "queensDraft" || operation === "connectPairsDraft" || operation === "pyramidDraft"
  );
}
