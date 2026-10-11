// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { GameRoomContext } from "@/types/view-models/room";
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
