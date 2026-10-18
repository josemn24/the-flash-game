import type { GameSessionCommand, GameSessionFailure } from "@/types/contracts/game-session";
import type { GameSessionResult } from "@/types/gameplay/authoritative-session";

/** One authority per engine. The provider owns validation, scoring and persistence. */
export interface GameSessionProvider {
  execute(
    command: GameSessionCommand,
    options?: { signal?: AbortSignal },
  ): Promise<GameSessionResult>;
}

/** Internal bridge for the existing engine's error handling. Never wraps an HTTP error. */
export class GameSessionCommandError extends Error {
  constructor(readonly failure: GameSessionFailure) {
    super(failure.code);
    this.name = "GameSessionCommandError";
  }
}

export interface SessionClock {
  now(): number;
  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
}
