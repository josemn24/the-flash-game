// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { GameRoomContext } from "@/types/view-models/room";
import type { ServerQueensQuestion } from "@/types/gameplay/challenge";
import type { ServerTimeTrialChallenge } from "@/types/gameplay/challenge";
import { useCompetitiveSession } from "@/features/game/competitive/core/useCompetitiveSession";
import { ServerFlashPopTimeTrialGame } from "./ServerFlashPopTimeTrialGame.client";

vi.mock("@/features/game/competitive/core/useCompetitiveSession", () => ({
  useCompetitiveSession: vi.fn(),
}));
const challenge: ServerTimeTrialChallenge = {
  id: "ct",
  definitionId: "ct",
  mode: "time-trial",
  number: 1,
  title: "Contrarreloj",
  subtitle: "",
  description: "",
  maxScore: 100,
  timeLimitMs: 10000,
  slots: [1, 2].map((index) => ({
    id: String(index),
    position: index,
    questionType: "queens",
    payloadSchemaVersion: 1,
    timeLimitMs: 1000,
    points: 50,
  })),
};
const context = { returnTo: "/salas/ct" } as GameRoomContext;
const question: ServerQueensQuestion = {
  id: "q1",
  category: "Queens",
  tags: {
    domains: [],
    topics: [],
    cognitiveSkills: [],
    formatSkills: [],
    lifeSkills: [],
  },
  question: "Tablero 1 de 6. Coloca una corona por fila, columna y región.",
  timeLimit: 10,
  points: 10,
  type: "queens",
  grid: { rows: 4, columns: 4 },
  regions: [0, 0, 1, 1, 0, 0, 1, 1, 2, 2, 3, 3, 2, 2, 3, 3],
  prefilledQueens: [0],
  progress: {
    kind: "queens",
    incorrectValidations: 0,
    maxIncorrectValidations: 3,
    queens: [0],
    placedQueens: 1,
    completedRows: 1,
    completedColumns: 1,
    completedRegions: 1,
    conflictingQueens: 0,
    solved: false,
  },
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});
it("keeps the global timer visible, mounted and running through validation, transition and loading", async () => {
  const state = {
    phase: "playing",
    results: [],
    deadlineAt: Date.now() + 10000,
    questionIndex: 0,
    busy: false,
    locked: false,
    question: null,
    abandon: vi.fn(),
    onTimeUp: vi.fn(),
    retryLifecycle: vi.fn(),
  };
  vi.mocked(useCompetitiveSession).mockImplementation(
    () => state as unknown as ReturnType<typeof useCompetitiveSession>,
  );
  const { rerender } = render(
    <ServerFlashPopTimeTrialGame challenge={challenge} roomContext={context} />,
  );
  const timer = screen.getByRole("timer");
  expect(timer.getAttribute("aria-label")).toBe("10 segundos restantes");
  for (const phase of ["checking", "transition", "preparing"]) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    state.phase = phase;
    rerender(<ServerFlashPopTimeTrialGame challenge={challenge} roomContext={context} />);
    expect(screen.getByRole("timer")).toBe(timer);
  }
  // Flush the next animation frame: display uses ceil(remaining) at the last RAF.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20);
  });
  expect(timer.getAttribute("aria-label")).toBe("4 segundos restantes");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  expect(state.onTimeUp).toHaveBeenCalledTimes(1);
});

it("renders Queens in the shared question stage and shows only the global timer", () => {
  vi.mocked(useCompetitiveSession).mockImplementation(
    () =>
      ({
        phase: "playing",
        results: [],
        deadlineAt: Date.now() + 10000,
        questionIndex: 0,
        question,
        busy: false,
        locked: false,
        queensState: "idle",
        queensStatusVisible: false,
        updateQueensDraft: vi.fn(),
        validateQueensBoard: vi.fn(),
        retryQueensValidation: vi.fn(),
        abandon: vi.fn(),
        onTimeUp: vi.fn(),
        retryLifecycle: vi.fn(),
      }) as unknown as ReturnType<typeof useCompetitiveSession>,
  );

  render(<ServerFlashPopTimeTrialGame challenge={challenge} roomContext={context} />);

  expect(
    screen.getByRole("heading", {
      name: "Tablero 1 de 6. Coloca una corona por fila, columna y región.",
    }),
  ).toBeTruthy();
  expect(screen.getByRole("grid", { name: "Tablero Queens de 4 por 4" })).toBeTruthy();
  expect(screen.getAllByRole("timer")).toHaveLength(1);
});

it("uses the Pyramid review layout with Contrarreloj progress labels", () => {
  const onBack = vi.fn();
  vi.mocked(useCompetitiveSession).mockImplementation(
    () =>
      ({
        phase: "review",
        results: [{ questionId: "1", status: "correct", points: 10 }],
        deadlineAt: null,
        questionIndex: 0,
        reviewChallenge: { mode: "flash", questions: [] },
        showResults: onBack,
      }) as unknown as ReturnType<typeof useCompetitiveSession>,
  );

  const { container } = render(
    <ServerFlashPopTimeTrialGame challenge={challenge} roomContext={context} />,
  );

  expect(screen.getByRole("heading", { name: "Historial de respuestas" })).toBeTruthy();
  expect(screen.getByRole("progressbar", { name: "Pruebas resueltas" })).toBeTruthy();
  const panel = container.querySelector('section[aria-labelledby="review-answers-title"]');
  expect(panel?.firstElementChild).toBe(
    screen.getByRole("button", { name: "Volver al resultado" }),
  );
});
