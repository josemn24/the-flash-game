import type { GameSessionProvider } from "@/application/ports/game-session";
import type { LocalSurvivalDefinition } from "@/types/gameplay/local-pyramid";
import {
  createLocalSequentialSessionProvider,
  type LocalSequentialOptions,
} from "./localShared/sequentialProvider";

export type LocalSurvivalOptions = Omit<LocalSequentialOptions, "definition"> & {
  readonly definition: LocalSurvivalDefinition;
};

/** In-memory Survival authority, with lives and early elimination from the shared mode policy. */
export function createLocalSurvivalSessionProvider(
  options: LocalSurvivalOptions,
): GameSessionProvider {
  return createLocalSequentialSessionProvider(options);
}
