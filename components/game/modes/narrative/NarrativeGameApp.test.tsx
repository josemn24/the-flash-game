// @vitest-environment jsdom
import { createElement, type ComponentProps, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { practiceInputFor } from "@/test-utils/practiceInput";
import { getChallengeById } from "@/test-utils/mockGameplay";
import { competitiveInputSource, competitiveQuestion } from "@/test-utils/competitiveInput";
import { competitiveRoomContext } from "@/test-utils/competitiveGameplay";
import { createCompetitiveInput } from "@/features/question-formats/createCompetitiveInput";
import type {
  AnswerResult,
  FlashChallenge,
  NarrativeChallenge,
  NarrativeScene,
  ServerNarrativeChallenge,
} from "@/types/gameplay";
import { initialNarrativeSessionState } from "@/features/narrative/narrativeSession";
import type { useNarrativeSession } from "@/features/narrative/useNarrativeSession";
import type { useServerNarrativeSession } from "@/features/game/useServerNarrativeSession";
import { NarrativeGameApp } from "./NarrativeGameApp.client";
import { ServerNarrativeGame } from "./ServerNarrativeGame.client";
import styles from "./NarrativeGame.module.css";

const { useLocal, useServer, snapshot, completion } = vi.hoisted(() => ({
  useLocal: vi.fn(),
  useServer: vi.fn(),
  snapshot: vi.fn(),
  completion: vi.fn(),
}));
vi.mock("@/features/narrative/useNarrativeSession", () => ({ useNarrativeSession: useLocal }));
vi.mock("@/features/game/useServerNarrativeSession", () => ({
  useServerNarrativeSession: useServer,
}));
vi.mock("@/features/rooms/useRoomAttemptSnapshot", () => ({
  useRoomAttemptResume: () => undefined,
  useRoomAttemptSnapshot: snapshot,
}));
vi.mock("@/features/game/useChallengeCompletionReporter", () => ({
  useChallengeCompletionReporter: completion,
}));
vi.mock("@/lib/miniWordleDictionary", () => ({
  loadMiniWordleDictionary: () => new Promise(() => {}),
}));
vi.mock("next/image", () => ({
  default: (props: ComponentProps<"img">) => {
    const domProps = { ...props };
    for (const key of ["preload", "unoptimized", "priority", "fill"])
      Reflect.deleteProperty(domProps, key);
    return createElement("img", domProps);
  },
}));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
const scene: NarrativeScene = {
  id: "opening",
  title: "Señal polar",
  presentation: "chapter-opening",
  blocks: [{ type: "narration", text: "Una voz entre el hielo." }],
};
const question = competitiveQuestion("short-text");
if (question.type !== "short-text") throw new Error("Expected short text");
const practiceQuestion = {
  ...question,
  correctAnswer: "hielo",
  explanation: "La señal viene del hielo.",
};
const localChallenge: NarrativeChallenge = {
  id: "narrative",
  definitionId: "narrative-definition",
  number: 1,
  title: "Registro polar",
  subtitle: "",
  description: "",
  mode: "narrative",
  implementationStatus: "complete",
  maxScore: 250,
  prologue: scene,
  beats: [
    { id: "beat", title: "Pruebas", steps: [{ type: "question", question: practiceQuestion }] },
  ],
};
const serverChallenge: ServerNarrativeChallenge = {
  ...localChallenge,
  slots: [
    {
      id: question.id,
      position: 1,
      questionType: "short-text",
      payloadSchemaVersion: 1,
      timeLimitMs: 60000,
      points: 250,
    },
  ],
  beats: [{ id: "beat", title: "Pruebas", steps: [{ type: "question", questionId: question.id }] }],
};
const result: AnswerResult = {
  questionId: question.id,
  answer: "hielo",
  status: "correct",
  isCorrect: true,
  points: 50,
  timeUsed: 4,
};
const review: FlashChallenge = {
  id: "review",
  definitionId: "review-definition",
  mode: "flash",
  number: 1,
  title: "Registro",
  subtitle: "",
  description: "",
  questions: [practiceQuestion],
  questionPoints: { [question.id]: 250 },
};
function localSession(
  overrides: Partial<ReturnType<typeof useNarrativeSession>> = {},
): ReturnType<typeof useNarrativeSession> {
  return {
    ...initialNarrativeSessionState,
    snapshot: initialNarrativeSessionState,
    currentStep: { type: "scene", scene },
    questionNumber: 1,
    totalQuestions: 1,
    score: 50,
    start: vi.fn(),
    continueScene: vi.fn(),
    replay: vi.fn(),
    showReview: vi.fn(),
    showResults: vi.fn(),
    submitAnswer: vi.fn(),
    handleTimeUp: vi.fn(),
    handleAnswerProgress: vi.fn(),
    handleIncorrectAttempt: vi.fn(),
    handleTimedResponseStart: vi.fn(),
    ...overrides,
  };
}
function serverSession(overrides: Partial<ReturnType<typeof useServerNarrativeSession>> = {}) {
  const inputSource = competitiveInputSource({ question, submit: vi.fn() });
  return {
    ...inputSource,
    questionInput: createCompetitiveInput(inputSource),
    phase: "scene",
    currentStep: { type: "scene", scene },
    stepIndex: 0,
    questionIndex: 0,
    questionNumber: 1,
    questionDeadlineAt: Date.now() + 60000,
    results: [result],
    lastResult: result,
    score: 50,
    attemptExpired: false,
    busy: false,
    reviewChallenge: review,
    continueScene: vi.fn(),
    begin: vi.fn(),
    handleTimeUp: vi.fn(),
    retryLifecycle: vi.fn(),
    retrySubmit: vi.fn(),
    showReview: vi.fn(),
    showResults: vi.fn(),
    ...overrides,
  };
}
beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("narrative containers keep their controller responsibilities", () => {
  it("preserves the real challenge's eight questions and format diversity", () => {
    const challenge = getChallengeById("tabarnia-challenge-04");
    if (challenge?.mode !== "narrative") throw new Error("Expected narrative challenge");
    const questions = challenge.beats.flatMap((beat) =>
      beat.steps.flatMap((step) => (step.type === "question" ? [step.question] : [])),
    );
    expect(questions).toHaveLength(8);
    expect([...new Set(questions.map((question) => question.type))].sort()).toEqual([
      "classification",
      "escape",
      "multiple-choice",
      "ordering",
      "zip",
    ]);
  });

  it("keeps practice scene navigation, the local question surface, feedback and review", () => {
    let session = localSession({ phase: "scene", stepIndex: 0 });
    useLocal.mockImplementation(() => session);
    const { container, rerender } = render(<NarrativeGameApp challenge={localChallenge} />);
    expect(container.querySelector("main")?.classList.contains(styles.darkStoryPhase)).toBe(true);
    expect(screen.getByLabelText("Página 1 de 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Seguir" }));
    expect(session.continueScene).toHaveBeenCalledOnce();
    session = localSession({
      phase: "playing",
      currentStep: { type: "question", question: practiceQuestion },
      stepIndex: 1,
    });
    rerender(<NarrativeGameApp challenge={localChallenge} />);
    expect(screen.getByRole("heading", { name: question.question })).toBeTruthy();
    expect(screen.getByRole("timer")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Escribe tu respuesta"), { target: { value: "hielo" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar respuesta" }));
    expect(session.submitAnswer).toHaveBeenCalledExactlyOnceWith("hielo");
    session = localSession({ phase: "transition", results: [result], stepIndex: 1 });
    rerender(<NarrativeGameApp challenge={localChallenge} />);
    expect(screen.getByRole("heading", { name: "Respuesta correcta" })).toBeTruthy();
    expect(screen.getByText("+50 puntos")).toBeTruthy();
    session = localSession({ phase: "results", results: [result] });
    rerender(<NarrativeGameApp challenge={localChallenge} />);
    expect(screen.getByLabelText("50 de 100 puntos")).toBeTruthy();
    expect(completion.mock.lastCall?.[0]).toMatchObject({
      challengeId: localChallenge.id,
      completed: true,
      flashPoints: 50,
    });
    fireEvent.click(screen.getByRole("button", { name: "Ver respuestas" }));
    expect(session.showReview).toHaveBeenCalledOnce();
    session = localSession({ phase: "review", results: [result] });
    rerender(<NarrativeGameApp challenge={localChallenge} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Volver al resultado" })[0]);
    expect(session.showResults).toHaveBeenCalledOnce();
  });

  it.each(["local", "server"])("keeps the %s blackout epilogue and its continuation", (mode) => {
    const blackout: NarrativeScene = { id: "end", presentation: "blackout", blocks: [] };
    const local = localSession({ phase: "scene", currentStep: { type: "scene", scene: blackout } });
    const server = serverSession({
      phase: "scene",
      currentStep: { type: "scene", scene: blackout },
    });
    useLocal.mockReturnValue(local);
    useServer.mockReturnValue(server);
    const { container } = render(
      mode === "local" ? (
        <NarrativeGameApp challenge={localChallenge} />
      ) : (
        <ServerNarrativeGame challenge={serverChallenge} roomContext={competitiveRoomContext} />
      ),
    );
    expect(container.querySelector("main")?.classList.contains(styles.blackoutPhase)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Ver resultado" }));
    expect((mode === "local" ? local : server).continueScene).toHaveBeenCalledOnce();
  });

  it("keeps competitive navigation, typed question input, checking feedback, results and authorized review", () => {
    let session = serverSession();
    useServer.mockImplementation(() => session);
    const { rerender } = render(
      <ServerNarrativeGame challenge={serverChallenge} roomContext={competitiveRoomContext} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Seguir" }));
    expect(session.continueScene).toHaveBeenCalledOnce();
    session = serverSession({ phase: "playing" });
    rerender(
      <ServerNarrativeGame challenge={serverChallenge} roomContext={competitiveRoomContext} />,
    );
    fireEvent.change(screen.getByLabelText("Escribe tu respuesta"), { target: { value: "hielo" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar respuesta" }));
    expect(screen.getByRole("timer")).toBeTruthy();
    expect(session.submit).toHaveBeenCalledExactlyOnceWith("hielo");
    session = serverSession({
      phase: "checking",
      submissionState: "error",
      submissionError: "Respuesta sin confirmar",
    });
    rerender(
      <ServerNarrativeGame challenge={serverChallenge} roomContext={competitiveRoomContext} />,
    );
    expect(screen.getByText("Respuesta sin confirmar")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(session.retrySubmit).toHaveBeenCalledOnce();
    session = serverSession({ phase: "transition" });
    rerender(
      <ServerNarrativeGame challenge={serverChallenge} roomContext={competitiveRoomContext} />,
    );
    expect(screen.getByRole("heading", { name: "Respuesta correcta" })).toBeTruthy();
    session = serverSession({ phase: "results" });
    rerender(
      <ServerNarrativeGame challenge={serverChallenge} roomContext={competitiveRoomContext} />,
    );
    expect(screen.getByLabelText("50 de 250 puntos")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver respuestas" }));
    expect(session.showReview).toHaveBeenCalledOnce();
    session = serverSession({ phase: "review" });
    rerender(
      <ServerNarrativeGame challenge={serverChallenge} roomContext={competitiveRoomContext} />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Volver al resultado" })[0]);
    expect(session.showResults).toHaveBeenCalledOnce();
  });

  it("keeps recovery, preparation and results without a server review", () => {
    let session = serverSession({ phase: "recovering", question: null, questionInput: null });
    useServer.mockImplementation(() => session);
    const { rerender } = render(
      <ServerNarrativeGame challenge={serverChallenge} roomContext={competitiveRoomContext} />,
    );
    expect(screen.getByRole("heading", { name: "Recuperando partida" })).toBeTruthy();
    session = serverSession({ phase: "preparing" });
    rerender(
      <ServerNarrativeGame challenge={serverChallenge} roomContext={competitiveRoomContext} />,
    );
    expect(screen.getByRole("heading", { name: "Preparando la siguiente prueba" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: question.question })).toBeNull();
    session = serverSession({ phase: "results", reviewChallenge: null, attemptExpired: true });
    rerender(
      <ServerNarrativeGame challenge={serverChallenge} roomContext={competitiveRoomContext} />,
    );
    expect(screen.getByRole("heading", { name: "Partida cerrada por inactividad" })).toBeTruthy();
    expect(screen.getByLabelText("0 de 250 puntos")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ver respuestas" })).toBeNull();
    expect(screen.getByRole("link", { name: "Volver" }).getAttribute("href")).toBe(
      competitiveRoomContext.returnTo,
    );
    expect(snapshot).not.toHaveBeenCalled();
    expect(completion).not.toHaveBeenCalled();
  });
});

describe("practice narrative timer policy", () => {
  it("defers only progressive-image until its image loads and forwards the start event once", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
    const question = practiceInputFor("progressive-image").props.question;
    const session = localSession({ phase: "playing", currentStep: { type: "question", question } });
    useLocal.mockReturnValue(session);
    render(<NarrativeGameApp challenge={localChallenge} />);
    expect(screen.queryByRole("timer")).toBeNull();
    const image = screen.getByAltText(question.surface.alt);
    fireEvent.load(image);
    fireEvent.load(image);
    expect(screen.getByRole("timer")).toBeTruthy();
    expect(session.handleTimedResponseStart).toHaveBeenCalledOnce();
  });

  it.each(["flash-memory", "simon-sequence", "mini-wordle"] as const)(
    "retains Narrative's immediate timer for %s",
    (format) => {
      const question = practiceInputFor(format).props.question;
      const session = localSession({
        phase: "playing",
        currentStep: { type: "question", question },
      });
      useLocal.mockReturnValue(session);
      render(<NarrativeGameApp challenge={localChallenge} />);
      expect(screen.getByRole("timer")).toBeTruthy();
      expect(session.handleTimedResponseStart).not.toHaveBeenCalled();
    },
  );
});
