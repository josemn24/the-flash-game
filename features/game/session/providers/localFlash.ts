import type { GameSessionProvider, SessionClock } from "@/application/ports/game-session";
import type { LocalFlashDefinition } from "@/types/gameplay/local-pyramid";
import {
  createLocalSequentialSessionProvider,
  type LocalSequentialOptions,
} from "./localShared/sequentialProvider";

export type LocalFlashOptions = Omit<LocalSequentialOptions, "definition"> & {
  readonly definition: LocalFlashDefinition;
};

/** In-memory Flash authority. It uses the canonical evaluator and session contract. */
export function createLocalFlashSessionProvider(
  options: LocalFlashOptions,
): GameSessionProvider {
  return createLocalSequentialSessionProvider(options);
}

export type { SessionClock };
