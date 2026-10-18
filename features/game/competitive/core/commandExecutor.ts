import type { GameSessionProvider } from "@/application/ports/game-session";
import type { GameSessionCommandInputs } from "@/types/contracts/game-session";
import type { GameSessionResult } from "@/types/gameplay/authoritative-session";
import { createSessionCommandId } from "../../session/commandId";
import type { Attempt, Operation, PendingCommand } from "./sessionReducer";

export class PendingCommandBlocked extends Error {}
export type CommandData<K extends Operation> = Omit<
  GameSessionCommandInputs[K],
  "sessionId" | "revision" | "idempotencyKey"
>;
/** One queue for every mutation of an attempt, including draft persistence. */
export class CommandExecutor {
  private queue: Promise<unknown> = Promise.resolve();
  private scheduled = new Set<Operation>();
  constructor(
    private readonly provider: GameSessionProvider,
    private readonly attempt: () => Attempt | null,
    private readonly pending: () => PendingCommand | null,
    private readonly signal?: AbortSignal,
  ) {}
  execute<K extends Operation>(
    operation: K,
    data: CommandData<K>,
    send: (command: PendingCommand, invoke: () => Promise<GameSessionResult>) => Promise<void>,
  ) {
    if (operation !== "queensDraft" && this.scheduled.has(operation))
      return Promise.reject(new PendingCommandBlocked());
    const originalData = structuredClone(data);
    this.scheduled.add(operation);
    return this.enqueue(async () => {
      if (this.pending()) throw new PendingCommandBlocked();
      const attempt = this.attempt();
      if (
        operation !== "start" &&
        operation !== "prepareSession" &&
        operation !== "takeover" &&
        !attempt
      )
        throw new PendingCommandBlocked();
      const input = {
        ...originalData,
        ...(attempt && operation !== "start" && operation !== "prepareSession"
          ? { sessionId: attempt.id, revision: attempt.revision }
          : {}),
        ...(operation !== "recover" && operation !== "abandon" && operation !== "prepareSession"
          ? { idempotencyKey: createSessionCommandId(operation) }
          : {}),
      } as GameSessionCommandInputs[K];
      const command = { operation, input } as PendingCommand;
      await send(command, () => this.invoke(command));
    }).finally(() => this.scheduled.delete(operation));
  }
  executeInput<K extends Operation>(
    operation: K,
    input: GameSessionCommandInputs[K],
    send: (command: PendingCommand, invoke: () => Promise<GameSessionResult>) => Promise<void>,
  ) {
    if (operation !== "queensDraft" && this.scheduled.has(operation))
      return Promise.reject(new PendingCommandBlocked());
    const originalInput = structuredClone(input);
    this.scheduled.add(operation);
    return this.enqueue(async () => {
      if (this.pending()) throw new PendingCommandBlocked();
      const command = { operation, input: originalInput } as PendingCommand;
      await send(command, () => this.invoke(command));
    }).finally(() => this.scheduled.delete(operation));
  }
  retry(
    command: PendingCommand,
    send: (command: PendingCommand, invoke: () => Promise<GameSessionResult>) => Promise<void>,
  ) {
    return this.enqueue(() => send(command, () => this.invoke(command)));
  }
  private invoke(command: PendingCommand): Promise<GameSessionResult> {
    return this.provider.execute(command, { signal: this.signal });
  }
  private enqueue(work: () => Promise<void>) {
    const next = this.queue.then(work);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
