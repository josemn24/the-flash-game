import type { GameSessionProvider, SessionClock } from "@/application/ports/game-session";
import type { GameSessionCommand, GameSessionOperation } from "@/types/contracts/game-session";
import type {
  GameSessionAcceptance,
  GameSessionResult,
} from "@/types/gameplay/authoritative-session";
import type { SessionAction } from "./corpus";
import { randomUuid } from "@/lib/randomUuid";

export function manualClock(initial = Date.parse("2026-10-18T12:00:00Z")) {
  let now = initial;
  return {
    now: () => now,
    set: (time: number) => {
      now = time;
    },
    advance: (ms: number) => {
      now += ms;
    },
    setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
  } satisfies SessionClock & { set(time: number): void; advance(ms: number): void };
}
export function confirmed(result: GameSessionResult): GameSessionAcceptance {
  if (result.kind !== "accepted") throw new Error(JSON.stringify(result));
  return result;
}
export class SessionDriver {
  private readonly keyPrefix = `conformance-${randomUuid()}`;
  sessionId = "";
  revision = 0;
  sequence = 0;
  constructor(
    readonly provider: GameSessionProvider,
    readonly challengeId: string,
    readonly itemIds: readonly string[],
  ) {}
  command(operation: GameSessionOperation, data: object = {}, index = 0): GameSessionCommand {
    const context = { sessionId: this.sessionId, revision: this.revision };
    const input =
      operation === "prepareSession"
        ? { challengeId: this.challengeId }
        : operation === "start"
          ? {
              challengeId: this.challengeId,
              idempotencyKey: `${this.keyPrefix}:start:${++this.sequence}`,
            }
          : operation === "recover" || operation === "abandon"
            ? context
            : {
                ...context,
                idempotencyKey: `${this.keyPrefix}:${operation}:${++this.sequence}`,
                ...(!["prepare", "complete"].includes(operation)
                  ? { challengeItemId: this.itemIds[index] }
                  : {}),
              };
    return { operation, input: { ...input, ...data } } as GameSessionCommand;
  }
  async execute(command: GameSessionCommand, signal?: AbortSignal) {
    const result = await this.provider.execute(command, { signal });
    if (result.kind === "accepted") {
      this.sessionId = result.state.sessionId ?? this.sessionId;
      this.revision = result.state.revision ?? this.revision;
    }
    return result;
  }
  async issue(operation: GameSessionOperation, data: object = {}, index = 0) {
    return confirmed(await this.execute(this.command(operation, data, index)));
  }
  async begin() {
    await this.issue("prepareSession");
    return this.issue("start");
  }
  async open(index = 0) {
    await this.issue("prepare", {}, index);
    return this.issue("activate", {}, index);
  }
  async action(action: SessionAction, index = 0) {
    return this.issue(action.operation, action.input, index);
  }
}

export function loseConfirmation(
  provider: GameSessionProvider,
  operation: GameSessionOperation,
): GameSessionProvider {
  let lost = false;
  return {
    async execute(command, options) {
      const result = await provider.execute(command, options);
      if (!lost && command.operation === operation && result.kind === "accepted") {
        lost = true;
        return { kind: "uncertain", code: "request_timeout", retryable: true };
      }
      return result;
    },
  };
}
