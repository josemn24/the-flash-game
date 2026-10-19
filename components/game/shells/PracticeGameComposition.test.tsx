// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlashGameApp } from "./FlashGameApp.client";
import { SurvivalGameApp } from "./SurvivalGameApp.client";
import { FlashPopFlashGame } from "../modes/flash-pop/FlashPopFlashGame.client";
import { FlashPopSurvivalGame } from "../modes/flash-pop/FlashPopSurvivalGame.client";
import type { useGameSession, GameSessionSnapshot } from "@/features/game/useGameSession";
import type {
  useSurvivalSession,
  SurvivalSessionSnapshot,
} from "@/features/game/useSurvivalSession";
import { getChallengeById } from "@/test-utils/mockGameplay";
import { socialSnapshot } from "@/test-utils/competitiveGameplay";
import { practiceInputFor } from "@/test-utils/practiceInput";
import type { AnswerResult } from "@/types/gameplay/result";

const { useFlash, useSurvival } = vi.hoisted(() => ({
  useFlash: vi.fn(),
  useSurvival: vi.fn(),
}));
vi.mock("@/features/game/useGameSession", () => ({ useGameSession: useFlash }));
vi.mock("@/features/game/useSurvivalSession", () => ({ useSurvivalSession: useSurvival }));
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
if (flashFixture?.mode !== "flash" || survivalFixture?.mode !== "survival")
  throw new Error("Missing practice fixtures");
const flash = { ...flashFixture, questions: [question], questionPoints: { [question.id]: 100 } };
const survival = {
  ...survivalFixture,
  questions: [question],
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
});
