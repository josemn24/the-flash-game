import { expect, it, vi } from "vitest";
import { createCompetitiveAttemptClient } from "../attemptClient";
import type { CompetitiveJsonObject } from "../transport";
import { CommandExecutor } from "./commandExecutor";
import type { Attempt, PendingCommand } from "./sessionReducer";
it("captures queued payloads before callers mutate them and resolves the version at dispatch", async () => {
  const client = createCompetitiveAttemptClient();
  let attempt: Attempt | null = { id: "attempt", lockVersion: 1 };
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
    client,
    () => attempt,
    () => pending,
  );
  const send = async (command: PendingCommand, invoke: () => Promise<CompetitiveJsonObject>) => {
    pending = command;
    const response = await invoke();
    attempt = { id: "attempt", lockVersion: Number(response.lockVersion) };
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
