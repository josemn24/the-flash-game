import type { GameSessionProvider } from "@/application/ports/game-session";
import type { GameSessionCommand, GameSessionFailure } from "@/types/contracts/game-session";
import type { GameSessionResult, SessionResultDraft } from "@/types/gameplay/authoritative-session";
/** Engine unit tests deliberately inject partial projections; boundary validation has its own tests. */
export type TestSessionResult = SessionResultDraft | GameSessionFailure;
export type TestSessionExecute = (
  command: GameSessionCommand,
  options?: { signal?: AbortSignal },
) => Promise<TestSessionResult>;
export function testSessionProvider(execute: TestSessionExecute): GameSessionProvider {
  return {
    async execute(command, options) {
      const result = await execute(command, options);
      return (
        result.kind === "accepted" ? { ...result, operation: command.operation } : result
      ) as GameSessionResult<typeof command.operation>;
    },
  };
}
