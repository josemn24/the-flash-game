import { expect, it, vi } from "vitest";
import { createCompetitiveAttemptClient } from "../attemptClient";
import type { CompetitiveJsonObject } from "../transport";
import type { GameSessionResult } from "@/types/gameplay/authoritative-session";
import { createRemoteGameSessionProvider } from "../../session/providers/remote";
import { CommandExecutor } from "./commandExecutor";
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
    createRemoteGameSessionProvider({ client }),
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
