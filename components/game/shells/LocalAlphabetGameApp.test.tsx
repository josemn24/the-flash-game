import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createMockFlashPopAlphabetDemoDefinition } from "@/infrastructure/mock/localPyramidDefinition";
import type { ChallengeCompletionResult } from "@/types/gameplay/completion";

const mocks = vi.hoisted(() => ({
  session: null as unknown,
}));

vi.mock("@/features/game/session/providers/localAlphabet", () => ({
  createLocalAlphabetSessionProvider: () => ({}),
}));
vi.mock("@/features/game/useServerAlphabetSession", () => ({
  useAlphabetGameSession: () => mocks.session,
}));
vi.mock("@/components/game/modes/flash-pop/ServerFlashPopAlphabetGame.client", () => ({
  AlphabetGameView: () => null,
}));
vi.mock("@/features/game/useChallengeCompletionReporter", () => ({
  useChallengeCompletionReporter(result: object | null, onComplete?: (value: object) => void) {
    if (result) onComplete?.({ ...result, playedAt: "2026-10-18T12:00:10.000Z" });
  },
}));

import { LocalAlphabetGameApp } from "./LocalAlphabetGameApp.client";

describe("LocalAlphabetGameApp completion bridge", () => {
  it("preserves the mock completion callback contract after the shared session finishes", () => {
    const definition = createMockFlashPopAlphabetDemoDefinition();
    const onComplete = vi.fn<(result: ChallengeCompletionResult) => void>();
    mocks.session = {
      phase: "results",
      deadlineAt: Date.parse("2026-10-18T12:02:30.000Z"),
      score: 100,
      results: definition.challenge.entries.map((entry) => ({
        questionId: entry.id,
        answer: "respuesta",
        status: "correct",
        isCorrect: true,
        points: entry.points,
        timeUsed: 1,
      })),
    };

    renderToStaticMarkup(<LocalAlphabetGameApp definition={definition} onComplete={onComplete} />);

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        challengeId: definition.challenge.id,
        flashPoints: 100,
        completed: true,
        durationMs: 16_000,
        answers: expect.arrayContaining([
          expect.objectContaining({
            questionId: definition.challenge.entries[0]!.id,
            status: "correct",
            isCorrect: true,
          }),
        ]),
        playedAt: "2026-10-18T12:00:10.000Z",
      }),
    );
  });
});
