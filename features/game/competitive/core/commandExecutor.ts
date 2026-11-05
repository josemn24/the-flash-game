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
const isCheckpoint = (operation: Operation) =>
  operation === "queensDraft" || operation === "connectPairsDraft";

/** Definitive writes stay ordered; a superseded checkpoint cannot hold the queue. */
export class CommandExecutor {
  private queue: Promise<unknown> = Promise.resolve();
  private scheduled = new Map<Operation, symbol>();
  private generation = 0;
  constructor(
    private readonly provider: GameSessionProvider,
    private readonly attempt: () => Attempt | null,
    private readonly pending: () => PendingCommand | null,
    private readonly signal?: AbortSignal,
  ) {}
  execute<K extends Operation>(
    operation: K,
    data: CommandData<K>,
    send: (
      command: PendingCommand<K>,
      invoke: () => Promise<GameSessionResult<K>>,
    ) => Promise<void>,
  ) {
    if (!isCheckpoint(operation) && this.scheduled.has(operation))
      return Promise.reject(new PendingCommandBlocked());
    const originalData = structuredClone(data);
    const generation = this.generation;
    const owner = this.reserve(operation);
    return this.enqueue(async () => {
      if (generation !== this.generation) throw new PendingCommandBlocked();
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
      const command = { operation, input } as PendingCommand<K>;
      await send(command, () => this.invoke(command));
    }).finally(() => this.release(operation, owner));
  }
  executeInput<K extends Operation>(
    operation: K,
    input: GameSessionCommandInputs[K],
    send: (
      command: PendingCommand<K>,
      invoke: () => Promise<GameSessionResult<K>>,
    ) => Promise<void>,
  ) {
    if (!isCheckpoint(operation) && this.scheduled.has(operation))
      return Promise.reject(new PendingCommandBlocked());
    const originalInput = structuredClone(input);
    const generation = this.generation;
    const owner = this.reserve(operation);
    return this.enqueue(async () => {
      if (generation !== this.generation) throw new PendingCommandBlocked();
      if (this.pending()) throw new PendingCommandBlocked();
      const command = { operation, input: originalInput } as PendingCommand<K>;
      await send(command, () => this.invoke(command));
    }).finally(() => this.release(operation, owner));
  }
  /** Deadline operations may overtake a best-effort checkpoint after server time expires. */
  executeImmediate<K extends Operation>(
    operation: K,
    data: CommandData<K>,
    send: (
      command: PendingCommand<K>,
      invoke: () => Promise<GameSessionResult<K>>,
    ) => Promise<void>,
  ) {
    const pending = this.pending();
    if (pending && !isCheckpoint(pending.operation))
      return Promise.reject(new PendingCommandBlocked());
    const attempt = this.attempt();
    if (!attempt) return Promise.reject(new PendingCommandBlocked());
    // Retire unsent work and detach the old transport wait. Subsequent writes
    // depend on this definitive command, whose SQL transaction orders the writes.
    this.generation++;
    this.scheduled.clear();
    const owner = this.reserve(operation);
    let releaseQueue!: () => void;
    this.queue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });
    const input = {
      ...structuredClone(data),
      sessionId: attempt.id,
      revision: attempt.revision,
      idempotencyKey: createSessionCommandId(operation),
    } as GameSessionCommandInputs[K];
    const command = { operation, input } as PendingCommand<K>;
    return send(command, () => this.invoke(command)).finally(() => {
      this.release(operation, owner);
      releaseQueue();
    });
  }
  retry<K extends Operation>(
    command: PendingCommand<K>,
    send: (
      command: PendingCommand<K>,
      invoke: () => Promise<GameSessionResult<K>>,
    ) => Promise<void>,
  ) {
    const generation = this.generation;
    return this.enqueue(async () => {
      if (generation !== this.generation) throw new PendingCommandBlocked();
      await send(command, () => this.invoke(command));
    });
  }
  private reserve(operation: Operation) {
    const owner = Symbol(operation);
    this.scheduled.set(operation, owner);
    return owner;
  }
  private release(operation: Operation, owner: symbol) {
    if (this.scheduled.get(operation) === owner) this.scheduled.delete(operation);
  }
  private invoke<K extends Operation>(command: PendingCommand<K>): Promise<GameSessionResult<K>> {
    return this.provider.execute(command, { signal: this.signal });
  }
  private enqueue(work: () => Promise<void>) {
    const next = this.queue.then(work);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
