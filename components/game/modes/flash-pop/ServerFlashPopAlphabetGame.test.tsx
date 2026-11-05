// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { initialSessionState } from "@/features/game/competitive/core/sessionReducer";
import { useCompetitiveSession } from "@/features/game/competitive/core/useCompetitiveSession";
import type { ServerAlphabetChallenge, ServerAlphabetQuestion } from "@/types/gameplay/challenge";
import type { GameRoomContext } from "@/types/view-models/room";
import { ServerFlashPopAlphabetGame } from "./ServerFlashPopAlphabetGame.client";

vi.mock("@/features/game/competitive/core/useCompetitiveSession", () => ({
  useCompetitiveSession: vi.fn(),
}));

const challenge: ServerAlphabetChallenge = {
  id: "alphabet",
  definitionId: "alphabet",
  number: 1,
  title: "Alfabeto",
  subtitle: "",
  description: "",
  mode: "alphabet",
  timeLimitMs: 150_000,
  maxScore: 100,
  entries: ["A", "B"].map((letter, index) => ({
    id: `item-${letter}`,
    position: index + 1,
    letter,
    questionType: "short-text",
    payloadSchemaVersion: 1,
    timeLimitMs: 150_000,
    points: 50,
  })),
};
const roomContext = { returnTo: "/salas/alphabet" } as GameRoomContext;
const question: ServerAlphabetQuestion = {
  id: "item-A",
  category: "Animales",
  tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
  question: "Mamífero protegido por una coraza de placas óseas.",
  timeLimit: 150,
  points: 50,
  type: "short-text",
  letter: "A",
  answerPlaceholder: null,
  answerLength: 9,
};

function mockSession(deadlineAt: number | null) {
  const state = {
    ...initialSessionState("playing"),
    deadlineAt,
    question: question as ServerAlphabetQuestion | null,
    questionPresentedAt: Date.now(),
    submit: vi.fn(),
    pass: vi.fn(),
    onTimeUp: vi.fn(),
    retryLifecycle: vi.fn(),
  };
  vi.mocked(useCompetitiveSession).mockImplementation(
    () => state as unknown as ReturnType<typeof useCompetitiveSession>,
  );
  return state;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(Date.now()), 16),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it.each(["answer", "pass"] as const)(
  "keeps the remaining time visible and running during %s and the next letter preparation",
  async (operation) => {
    const state = mockSession(Date.now() + 120_000);
    const game = () => (
      <ServerFlashPopAlphabetGame challenge={challenge} roomContext={roomContext} />
    );
    const { rerender } = render(game());
    await act(() => vi.advanceTimersByTimeAsync(20));
    const timer = screen.getByRole("timer");
    expect(timer.getAttribute("aria-label")).toBe("120 segundos restantes");

    if (operation === "answer") {
      fireEvent.keyDown(screen.getByRole("textbox"), { key: "A" });
      fireEvent.click(screen.getByRole("button", { name: "Responder" }));
      expect(state.submit).toHaveBeenCalledWith("A");
      state.phase = "checking";
    } else {
      fireEvent.click(screen.getByRole("button", { name: "Pasar" }));
      expect(state.pass).toHaveBeenCalledOnce();
    }
    state.locked = true;
    state.busy = true;
    rerender(game());
    expect(timer.getAttribute("aria-label")).toBe("120 segundos restantes");
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(timer.getAttribute("aria-label")).toBe("119 segundos restantes");

    state.phase = "transition";
    state.busy = false;
    rerender(game());
    expect(screen.getByRole("timer")).toBe(timer);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(timer.getAttribute("aria-label")).toBe("118 segundos restantes");

    state.phase = "preparing";
    state.question = null;
    rerender(game());
    expect(screen.getByRole("timer")).toBe(timer);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(timer.getAttribute("aria-label")).toBe("117 segundos restantes");

    state.phase = "playing";
    state.locked = false;
    state.question = { ...question, id: "item-B", letter: "B" };
    state.questionPresentedAt = Date.now();
    rerender(game());
    expect(screen.getByRole("timer")).toBe(timer);
    expect(timer.getAttribute("aria-label")).toBe("117 segundos restantes");
    expect(state.onTimeUp).not.toHaveBeenCalled();
  },
);

it("notifies expiry once even while a command is pending", async () => {
  const state = mockSession(Date.now() + 1000);
  state.phase = "checking";
  state.locked = true;
  state.busy = true;
  render(<ServerFlashPopAlphabetGame challenge={challenge} roomContext={roomContext} />);

  await act(() => vi.advanceTimersByTimeAsync(1200));
  expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("Tiempo agotado");
  expect(state.onTimeUp).toHaveBeenCalledOnce();
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(state.onTimeUp).toHaveBeenCalledOnce();
});

it("waits for the global deadline before starting the timer", async () => {
  const state = mockSession(null);
  state.phase = "preparing";
  state.locked = true;
  state.question = null;
  const game = () => <ServerFlashPopAlphabetGame challenge={challenge} roomContext={roomContext} />;
  const { rerender } = render(game());

  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("150 segundos restantes");
  state.deadlineAt = Date.now() + 120_000;
  state.phase = "playing";
  state.locked = false;
  state.question = question;
  rerender(game());
  await act(() => vi.advanceTimersByTimeAsync(20));
  expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("120 segundos restantes");
  expect(state.onTimeUp).not.toHaveBeenCalled();
});
