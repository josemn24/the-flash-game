// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompetitiveAttemptClient } from "@/features/game/competitive/attemptClient";
import { sessionValidationContext } from "@/features/game/session/sessionResult";
import { createRemoteGameSessionProvider } from "@/features/game/session/providers/remote";
import { createLocalFlashSessionProvider } from "@/features/game/session/providers/localFlash";
import { createMockFlashPopFlashDemoDefinition } from "@/infrastructure/mock/localPyramidDefinition";
import { levelPayloads } from "@/features/game/session/providers/localShared/definition";
import { useFlashGameSession } from "@/features/game/useFlashGameSession";
import type { GameSessionProvider } from "@/application/ports/game-session";
import type { GameSessionBootstrap } from "@/types/gameplay/authoritative-session";
import { FlashGameView } from "./FlashGameView";

vi.mock("@/components/game/shared/StartCountdown.client", () => ({
  StartCountdown: ({ onComplete }: { onComplete: () => void }) => (
    <button onClick={onComplete}>Continuar cuenta atrás</button>
  ),
}));

const fullDefinition = createMockFlashPopFlashDemoDefinition();
const slot = fullDefinition.challenge.slots[0]!;
const level = fullDefinition.levels[0]!;
const definition = {
  challenge: { ...fullDefinition.challenge, slots: [slot], maxScore: slot.points },
  levels: [level],
};
const initialSession: GameSessionBootstrap = { status: "new", results: [], score: 0 };

function remoteProvider(): GameSessionProvider {
  const payload = levelPayloads(level);
  const now = () => new Date(Date.now()).toISOString();
  const client = {
    prepareSession: async () => ({ ready: true }),
    start: async () => ({
      attemptId: "remote-flash-test",
      lockVersion: 1,
      resumed: false,
      deadlineAt: null,
    }),
    prepare: async (input: { lockVersion: number }) => ({
      attemptId: "remote-flash-test",
      lockVersion: input.lockVersion + 1,
      challengeItemId: slot.id,
      publicPayload: payload.publicPayload,
      presentedAt: now(),
      deadlineAt: new Date(Date.now() + slot.timeLimitMs).toISOString(),
      timedOut: false,
    }),
    answer: async (input: { lockVersion: number; answer: unknown }) => ({
      attemptId: "remote-flash-test",
      lockVersion: input.lockVersion + 1,
      challengeItemId: slot.id,
      answer: input.answer,
      status: "incorrect",
      points: 0,
      timeUsedMs: 1000,
      timedOut: false,
    }),
    complete: async (input: { lockVersion: number }) => ({
      attemptId: "remote-flash-test",
      lockVersion: input.lockVersion + 1,
      phase: "results",
      score: 0,
      answers: [
        {
          challengeItemId: slot.id,
          answer: "La cultura azteca",
          status: "incorrect",
          points: 0,
          timeUsedMs: 1000,
        },
      ],
      review: [
        {
          challengeItemId: slot.id,
          publicPayload: payload.publicPayload,
          solutionPayload: payload.solutionPayload,
        },
      ],
    }),
  } as unknown as CompetitiveAttemptClient;
  return createRemoteGameSessionProvider({
    client,
    context: sessionValidationContext(definition.challenge),
  });
}

function SharedFlashExperience({ provider }: { provider: GameSessionProvider }) {
  const session = useFlashGameSession({
    challenge: definition.challenge,
    provider,
    initialSession,
  });
  return <FlashGameView challenge={definition.challenge} session={session} returnTo="/demo" />;
}

afterEach(() => {
  cleanup();
});

describe.each([
  ["local", () => createLocalFlashSessionProvider({ definition })],
  ["remote", remoteProvider],
])("shared Flash presentation with %s authority", (_authority, createProvider) => {
  it("uses the same intro, question, error feedback, result and review transitions", async () => {
    render(<SharedFlashExperience provider={createProvider()} />);
    fireEvent.click(screen.getByRole("button", { name: "Empezar desafío" }));
    fireEvent.click(await screen.findByRole("button", { name: "Continuar cuenta atrás" }));
    await screen.findByRole("heading", {
      name: "¿Qué cultura celebra en 2026 el Año del Caballo de Fuego, que se repite cada 60 años?",
    });

    fireEvent.click(screen.getByRole("button", { name: "La cultura azteca" }));
    await screen.findByRole("heading", { name: "Respuesta fallada" });
    await screen.findByRole("heading", { name: "Desafío duro." }, { timeout: 10_000 });
    fireEvent.click(screen.getByRole("button", { name: "Ver respuestas" }));
    expect(await screen.findByRole("heading", { name: "Historial de respuestas" })).toBeTruthy();
  }, 20_000);
});
