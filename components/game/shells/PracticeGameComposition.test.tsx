// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlashGameApp } from "./FlashGameApp.client";
import { SurvivalGameApp } from "./SurvivalGameApp.client";
import { FlashPopFlashGame } from "../modes/flash-pop/FlashPopFlashGame.client";
import { FlashPopSurvivalGame } from "../modes/flash-pop/FlashPopSurvivalGame.client";
import { FlashPopPyramidGame } from "../modes/flash-pop/FlashPopPyramidGame.client";
import { PyramidGameApp } from "../modes/pyramid/PyramidGameApp.client";
import type { useGameSession, GameSessionSnapshot } from "@/features/game/useGameSession";
import type {
  useSurvivalSession,
  SurvivalSessionSnapshot,
} from "@/features/game/useSurvivalSession";
import type { usePyramidSession } from "@/features/pyramid/usePyramidSession";
import { createPyramidAttempt } from "@/features/pyramid/pyramidAttempt";
import { getChallengeById } from "@/test-utils/mockGameplay";
import { socialSnapshot } from "@/test-utils/competitiveGameplay";
import { practiceInputFor } from "@/test-utils/practiceInput";
import { loadMiniWordleDictionary } from "@/lib/miniWordleDictionary";
import type { AnswerResult } from "@/types/gameplay/result";

const { useFlash, useSurvival, usePyramid } = vi.hoisted(() => ({
  useFlash: vi.fn(),
  useSurvival: vi.fn(),
  usePyramid: vi.fn(),
}));
vi.mock("@/features/game/useGameSession", () => ({ useGameSession: useFlash }));
vi.mock("@/features/game/useSurvivalSession", () => ({ useSurvivalSession: useSurvival }));
vi.mock("@/features/pyramid/usePyramidSession", () => ({ usePyramidSession: usePyramid }));
vi.mock("@/features/rooms/useRoomAttemptSnapshot", () => ({
  useRoomAttemptResume: () => undefined,
  useRoomAttemptSnapshot: vi.fn(),
}));
vi.mock("@/features/game/useChallengeCompletionReporter", () => ({
  useChallengeCompletionReporter: vi.fn(),
}));
vi.mock("@/lib/miniWordleDictionary", () => ({ loadMiniWordleDictionary: vi.fn() }));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
const question = practiceInputFor("short-text").props.question;
const flashFixture = getChallengeById("tabarnia-flash-01");
const survivalFixture = getChallengeById("tabarnia-challenge-03");
const pyramidFixture = getChallengeById("tabarnia-challenge-05");
if (
  flashFixture?.mode !== "flash" ||
  survivalFixture?.mode !== "survival" ||
  pyramidFixture?.mode !== "pyramid"
)
  throw new Error("Missing practice fixtures");
const flash = { ...flashFixture, questions: [question], questionPoints: { [question.id]: 100 } };
const survival = {
  ...survivalFixture,
  questions: [question],
  questionPoints: { [question.id]: 100 },
};
const pyramid = {
  ...pyramidFixture,
  levels: [{ ...pyramidFixture.levels[0], question }],
  questionPoints: { [question.id]: 100 },
};
const result: AnswerResult = {
  questionId: question.id,
  answer: "1945",
  status: "correct",
  isCorrect: true,
  points: 100,
  timeUsed: 2,
};

function flashSession(
  overrides: Partial<ReturnType<typeof useGameSession>> = {},
): ReturnType<typeof useGameSession> {
  const state: GameSessionSnapshot = {
    phase: "intro",
    questionIndex: 0,
    results: [result],
    locked: false,
    lastTimedOut: false,
    codeAttempts: [],
  };
  return {
    ...state,
    snapshot: state,
    question,
    score: 100,
    start: vi.fn(),
    beginCountdown: vi.fn(),
    replay: vi.fn(),
    submitAnswer: vi.fn(),
    handleCodeAttempt: vi.fn(() => false),
    handleTimeUp: vi.fn(),
    handleAnswerProgress: vi.fn(),
    handleIncorrectAttempt: vi.fn(),
    handleProgressiveClueReveal: vi.fn(),
    handleTimedResponseStart: vi.fn(),
    showReview: vi.fn(),
    showResults: vi.fn(),
    ...overrides,
  };
}
function survivalSession(
  overrides: Partial<ReturnType<typeof useSurvivalSession>> = {},
): ReturnType<typeof useSurvivalSession> {
  const base = flashSession();
  const state: SurvivalSessionSnapshot = {
    ...base.snapshot,
    livesRemaining: 3,
    pendingLifePenalty: false,
    mistakes: 0,
    eliminated: false,
    survived: true,
  };
  return { ...base, ...state, snapshot: state, reachedQuestionCount: 1, ...overrides };
}
function pyramidSession(
  overrides: Partial<ReturnType<typeof usePyramidSession>> = {},
): ReturnType<typeof usePyramidSession> {
  const record = {
    ...createPyramidAttempt(pyramid, Date.now()),
    results: [result],
    outcome: "summit" as const,
  };
  const summary = {
    challengeId: pyramid.id,
    startedAt: record.startedAt,
    levelsCleared: 1,
    score: 100,
    timeUsed: 2,
    outcome: "summit" as const,
    completedAt: Date.now(),
  };
  return {
    phase: "intro",
    record,
    snapshot: record,
    currentLevel: pyramid.levels[0],
    latestResult: result,
    summary,
    storageAvailable: true,
    locked: false,
    codeAttempts: [],
    initialAnswer: null,
    deadlineAt: Date.now() + 60000,
    start: vi.fn(),
    beginLevel: vi.fn(),
    restart: vi.fn(),
    armCurrentLevel: vi.fn(),
    submitAnswer: vi.fn(),
    handleTimeUp: vi.fn(),
    handleAnswerProgress: vi.fn(),
    handleIncorrectAttempt: vi.fn(),
    handleProgressiveClueReveal: vi.fn(),
    handleCodeAttempt: vi.fn(() => false),
    showReview: vi.fn(),
    showResults: vi.fn(),
    score: 100,
    levelsCleared: 1,
    ...overrides,
  };
}
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const standardSurfaces = [
  {
    name: "Flash clásico",
    build: flashSession,
    hook: useFlash,
    render: () => <FlashGameApp challenge={flash} />,
    pop: false,
  },
  {
    name: "Flash Pop",
    build: flashSession,
    hook: useFlash,
    render: () => <FlashPopFlashGame challenge={flash} />,
    pop: true,
  },
  {
    name: "Supervivencia clásica",
    build: survivalSession,
    hook: useSurvival,
    render: () => <SurvivalGameApp challenge={survival} />,
    pop: false,
  },
  {
    name: "Supervivencia Flash Pop",
    build: survivalSession,
    hook: useSurvival,
    render: () => <FlashPopSurvivalGame challenge={survival} socialSnapshot={socialSnapshot} />,
    pop: true,
  },
];
describe("practice game compositions", () => {
  it.each(standardSurfaces)(
    "$name preserves navigation, submission, feedback, results and review",
    (surface) => {
      let session = surface.build();
      surface.hook.mockImplementation(() => session);
      const view = render(surface.render());
      fireEvent.click(screen.getByRole("button", { name: "Empezar desafío" }));
      expect(surface.pop ? session.beginCountdown : session.start).toHaveBeenCalledOnce();
      session = { ...session, phase: "playing" };
      view.rerender(surface.render());
      expect(screen.getByRole("timer")).toBeTruthy();
      fireEvent.change(screen.getByLabelText("Escribe tu respuesta"), {
        target: { value: "1945" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Enviar respuesta" }));
      expect(session.submitAnswer).toHaveBeenCalledExactlyOnceWith("1945");
      session = { ...session, phase: "transition", locked: true };
      view.rerender(surface.render());
      expect(screen.queryByLabelText("Escribe tu respuesta")).toBeNull();
      expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
        /Respuesta (enviada|correcta)|Has sobrevivido/,
      );
      session = { ...session, phase: "results" };
      view.rerender(surface.render());
      fireEvent.click(screen.getByRole("button", { name: /Ver (soluciones|respuestas)|Revisar/ }));
      expect(session.showReview).toHaveBeenCalledOnce();
      session = { ...session, phase: "review" };
      view.rerender(surface.render());
      expect(screen.getByText(question.explanation)).toBeTruthy();
      fireEvent.click(screen.getAllByRole("button", { name: /Volver al resultado/ })[0]);
      expect(session.showResults).toHaveBeenCalledOnce();
    },
  );

  it.each([false, true])(
    "pyramid pop=%s preserves restoration, readiness, results and review",
    (pop) => {
      const clueQuestion = practiceInputFor("progressive-clues").props.question;
      const level = { ...pyramid.levels[0], question: clueQuestion };
      let session = pyramidSession({
        currentLevel: level,
        initialAnswer: "Marie",
        record: {
          ...createPyramidAttempt(pyramid, Date.now()),
          results: [result],
          progressiveCluesRevealed: 2,
          outcome: "summit",
        },
      });
      usePyramid.mockImplementation(() => session);
      const surface = () =>
        pop ? (
          <FlashPopPyramidGame challenge={pyramid} socialSnapshot={socialSnapshot} />
        ) : (
          <PyramidGameApp challenge={pyramid} />
        );
      const view = render(surface());
      fireEvent.click(screen.getByRole("button", { name: "Empezar desafío" }));
      expect(session.start).toHaveBeenCalledOnce();
      session = { ...session, phase: "playing" };
      view.rerender(surface());
      expect(session.armCurrentLevel).toHaveBeenCalledOnce();
      expect(screen.getByLabelText<HTMLInputElement>("Escribe tu respuesta").value).toBe("Marie");
      expect(screen.getByRole("list", { name: "Pistas reveladas" }).children).toHaveLength(
        pop ? 2 : 1,
      );
      fireEvent.click(screen.getByRole("button", { name: /Revelar otra pista/ }));
      if (pop) expect(session.handleProgressiveClueReveal).toHaveBeenCalledExactlyOnceWith(3);
      else expect(session.handleProgressiveClueReveal).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Enviar respuesta" }));
      expect(session.submitAnswer).toHaveBeenCalledExactlyOnceWith("Marie");
      session = { ...session, phase: "transition" };
      view.rerender(surface());
      expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
        /Nivel superado|Respuesta correcta|Cima conquistada|Desafío completado/,
      );
      session = { ...session, phase: "results" };
      view.rerender(surface());
      fireEvent.click(screen.getByRole("button", { name: /Ver (soluciones|respuestas)|Revisar/ }));
      expect(session.showReview).toHaveBeenCalledOnce();
      session = { ...session, phase: "review" };
      view.rerender(surface());
      fireEvent.click(screen.getAllByRole("button", { name: /Volver al resultado/ })[0]);
      expect(session.showResults).toHaveBeenCalledOnce();
    },
  );

  it("preserves Flash Pop pyramid's Mini-Wordle readiness chain after dictionary loading", async () => {
    const question = practiceInputFor("mini-wordle").props.question;
    let resolve!: (words: Set<string>) => void;
    vi.mocked(loadMiniWordleDictionary).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const session = pyramidSession({
      phase: "playing",
      currentLevel: { ...pyramid.levels[0], question },
    });
    usePyramid.mockReturnValue(session);
    render(<FlashPopPyramidGame challenge={pyramid} socialSnapshot={socialSnapshot} />);
    expect(session.armCurrentLevel).not.toHaveBeenCalled();
    const { act } = await import("@testing-library/react");
    await act(async () => resolve(new Set(["LUNA"])));
    expect(session.armCurrentLevel).toHaveBeenCalledTimes(2);
  });
});
