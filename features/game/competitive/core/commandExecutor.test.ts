import { clientWithWireFixtures, wireValidationContext } from "@/test-utils/sessionWire";
import { expect, it, vi } from "vitest";
import { createCompetitiveAttemptClient } from "../attemptClient";
import type { CompetitiveJsonObject } from "../transport";
import type { GameSessionResult } from "@/types/gameplay/authoritative-session";
import { createRemoteGameSessionProvider } from "../../session/providers/remote";
import { CommandExecutor, PendingCommandBlocked } from "./commandExecutor";
import type { GameSessionProvider } from "@/application/ports/game-session";
import type { GameSessionCommand } from "@/types/contracts/game-session";
import type { Attempt, PendingCommand } from "./sessionReducer";
it("captures queued payloads before callers mutate them and resolves the version at dispatch", async () => {
  const client = createCompetitiveAttemptClient();
  let attempt: Attempt | null = { id: "attempt", revision: 1 };
  let pending: PendingCommand | null = null;
  let resolve!: (value: CompetitiveJsonObject) => void;
  client.queensDraft = vi.fn(
    () =>
      new Promise<CompetitiveJsonObject>((done) => {
        resolve = done;
      }),
  );
  client.queensValidation = vi.fn(async () => ({ lockVersion: 3 }));
  const executor = new CommandExecutor(
    createRemoteGameSessionProvider({
      client: clientWithWireFixtures(client),
      context: wireValidationContext,
    }),
    () => attempt,
    () => pending,
  );
  const send = async (command: PendingCommand, invoke: () => Promise<GameSessionResult>) => {
    pending = command;
    const response = await invoke();
    if (response.kind !== "accepted") throw new Error(response.code);
    attempt = { id: "attempt", revision: Number(response.state.revision) };
    pending = null;
  };
  const first = executor.execute("queensDraft", { challengeItemId: "item", queens: [2, 4] }, send);
  const board = [2, 4, 11, 13];
  const second = executor.execute(
    "queensValidation",
    { challengeItemId: "item", queens: board },
    send,
  );
  board[0] = 0;
  await Promise.resolve();
  expect(client.queensValidation).not.toHaveBeenCalled();
  resolve({ lockVersion: 2 });
  await Promise.all([first, second]);
  expect(client.queensValidation).toHaveBeenCalledWith(
    expect.objectContaining({ lockVersion: 2, queens: [2, 4, 11, 13] }),
  );
});

it("retires queued commands and retries while a definitive answer replaces the transport barrier", async () => {
  let attempt: Attempt = { id: "attempt", revision: 1 };
  let pending: PendingCommand | null = null;
  let releaseDraft!: () => void;
  let releasePreparation!: () => void;
  const draftWait = new Promise<void>((resolve) => {
    releaseDraft = resolve;
  });
  const preparationWait = new Promise<void>((resolve) => {
    releasePreparation = resolve;
  });
  const operations: string[] = [];
  const provider = {
    execute: async (command: GameSessionCommand) => {
      operations.push(command.operation);
      if (command.operation === "queensDraft") await draftWait;
      if (command.operation === "prepare") await preparationWait;
      return {
        kind: "accepted",
        operation: command.operation,
        effect: "acknowledged",
        state: { sessionId: "attempt", revision: attempt.revision + 1 },
      };
    },
  } as GameSessionProvider;
  const executor = new CommandExecutor(
    provider,
    () => attempt,
    () => pending,
  );
  const send = async (command: PendingCommand, invoke: () => Promise<GameSessionResult>) => {
    pending = command;
    const response = await invoke();
    if (response.kind === "accepted" && pending === command) {
      attempt = { id: "attempt", revision: Number(response.state.revision) };
      pending = null;
    }
  };
  const saving = executor.execute("queensDraft", { challengeItemId: "item", queens: [2] }, send);
  await Promise.resolve();
  const original = pending!;
  const retiredPreparation = executor.execute("prepare", {}, send).catch((error: unknown) => error);
  const retiredRetry = executor.retry(original, send).catch((error: unknown) => error);
  await executor.executeImmediate("answer", { challengeItemId: "item", answer: null }, send);
  const preparation = executor.execute("prepare", {}, send);
  await Promise.resolve();
  expect(operations).toEqual(["queensDraft", "answer", "prepare"]);
  releaseDraft();
  await saving;
  expect(await retiredPreparation).toBeInstanceOf(PendingCommandBlocked);
  expect(await retiredRetry).toBeInstanceOf(PendingCommandBlocked);
  // Cleanup from the retired prepare must not delete the new prepare's reservation.
  await expect(executor.execute("prepare", {}, send)).rejects.toBeInstanceOf(PendingCommandBlocked);
  releasePreparation();
  await preparation;
  expect(attempt.revision).toBe(3);
});

it("does not allow an immediate command to overtake a definitive write", async () => {
  const pending = { operation: "answer", input: {} } as PendingCommand;
  const execute = vi.fn();
  const executor = new CommandExecutor(
    { execute } as GameSessionProvider,
    () => ({ id: "attempt", revision: 2 }),
    () => pending,
  );
  await expect(executor.executeImmediate("complete", {}, async () => {})).rejects.toBeInstanceOf(
    PendingCommandBlocked,
  );
  expect(execute).not.toHaveBeenCalled();
});
