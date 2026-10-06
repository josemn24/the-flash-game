import type { CompetitiveAttemptClient } from "../attemptClient";
import { createCompetitiveIdempotencyKey, type CompetitiveJsonObject } from "../transport";
import type { Attempt, Operation, PendingCommand } from "./sessionReducer";

export class PendingCommandBlocked extends Error {}
export type CommandData<K extends Operation> = Omit<
  Parameters<CompetitiveAttemptClient[K]>[0],
  "attemptId" | "lockVersion" | "idempotencyKey"
>;
/** One queue for every mutation of an attempt, including draft persistence. */
export class CommandExecutor {
  private queue: Promise<unknown> = Promise.resolve();
  private scheduled = new Set<Operation>();
  constructor(
    private readonly client: CompetitiveAttemptClient,
    private readonly attempt: () => Attempt | null,
    private readonly pending: () => PendingCommand | null,
  ) {}
  execute<K extends Operation>(
    operation: K,
    data: CommandData<K>,
    send: (command: PendingCommand, invoke: () => Promise<CompetitiveJsonObject>) => Promise<void>,
  ) {
    if (operation !== "queensDraft" && this.scheduled.has(operation))
      return Promise.reject(new PendingCommandBlocked());
    const originalData = structuredClone(data);
    this.scheduled.add(operation);
    return this.enqueue(async () => {
      if (this.pending()) throw new PendingCommandBlocked();
      const attempt = this.attempt();
      if (operation !== "start" && operation !== "prepareSession" && !attempt)
        throw new PendingCommandBlocked();
      const input = {
        ...originalData,
        ...(attempt && operation !== "start" && operation !== "prepareSession"
          ? { attemptId: attempt.id, lockVersion: attempt.lockVersion }
          : {}),
        ...(operation !== "recover" && operation !== "abandon"
          ? { idempotencyKey: createCompetitiveIdempotencyKey(operation) }
          : {}),
      };
      const command = { operation, input } as PendingCommand;
      await send(command, () => this.invoke(command));
    }).finally(() => this.scheduled.delete(operation));
  }
  retry(
    command: PendingCommand,
    send: (command: PendingCommand, invoke: () => Promise<CompetitiveJsonObject>) => Promise<void>,
  ) {
    return this.enqueue(() => send(command, () => this.invoke(command)));
  }
  private invoke(command: PendingCommand): Promise<CompetitiveJsonObject> {
    // The discriminated command preserves the client method's original wire input.
    const method = this.client[command.operation] as (
      input: PendingCommand["input"],
    ) => Promise<CompetitiveJsonObject>;
    return method(command.input);
  }
  private enqueue(work: () => Promise<void>) {
    const next = this.queue.then(work);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
