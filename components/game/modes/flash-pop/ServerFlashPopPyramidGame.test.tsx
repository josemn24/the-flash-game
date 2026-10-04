import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerFlashPopPyramidGame } from "./ServerFlashPopPyramidGame.client";
import { initialSessionState } from "@/features/game/competitive/core/sessionReducer";
import { questionFromPayload } from "@/features/game/serverFlashQuestionAdapter";
import type { GameRoomContext } from "@/types/view-models/room";
import type { ServerPyramidChallenge } from "@/types/gameplay/challenge";

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/features/game/useServerFlashSession", () => ({ useServerFlashSession: useSession }));

const challenge: ServerPyramidChallenge = {
  id: "challenge-1",
  definitionId: "definition-1",
  number: 1,
  title: "La Pirámide",
  subtitle: "Ascenso",
  description: "Supera los niveles.",
  mode: "pyramid",
  attemptVersion: 1,
  availableFrom: "2026-01-01T00:00:00.000Z",
  availableUntil: "2026-12-31T23:59:59.000Z",
  maxScore: 100,
  levels: Array.from({ length: 7 }, (_, index) => ({
    id: `level-${index + 1}`,
    position: index + 1,
    levelId: `level-${index + 1}`,
    label: `Nivel ${index + 1}`,
    briefing: {
      title: `Prueba ${index + 1}`,
      format: "Lógica",
      description: "Resuelve la prueba.",
    },
    questionType: "multiple-choice" as const,
    payloadSchemaVersion: 1,
    timeLimitMs: 30_000,
    points: 10,
  })),
};

const roomContext = { returnTo: "/salas/sala" } as GameRoomContext;
const question = questionFromPayload(
  "level-1",
  { question: "Pregunta que debe permanecer oculta", options: ["Opción A", "Opción B"] },
  30_000,
  10,
  "multiple-choice",
);
const renderGame = () =>
  renderToStaticMarkup(
    <ServerFlashPopPyramidGame challenge={challenge} roomContext={roomContext} />,
  );

beforeEach(() => {
  useSession.mockReturnValue({ ...initialSessionState("preparing"), retryLifecycle: vi.fn() });
});

describe("Pyramid question loading", () => {
  it.each([null, question])("keeps the question hidden until activation: %s", (pendingQuestion) => {
    useSession.mockReturnValue({
      ...initialSessionState("preparing"),
      question: pendingQuestion,
      retryLifecycle: vi.fn(),
    });
    const markup = renderGame();

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Cargando pregunta…");
    expect(markup).toContain("Espera un momento…");
    expect(markup).not.toContain(question.question);
    expect(markup).not.toContain("Opción A");
    expect(markup).not.toContain("Preparando el nivel");
    expect(markup).not.toContain('role="timer"');
  });

  it("shows the question and timer once the level is activated", () => {
    useSession.mockReturnValue({
      ...initialSessionState("playing"),
      question,
      questionPresentedAt: Date.now(),
      questionDeadlineAt: Date.now() + 30_000,
      retryLifecycle: vi.fn(),
    });
    const markup = renderGame();

    expect(markup).toContain(question.question);
    expect(markup).toContain("Opción A");
    expect(markup).toContain('role="timer"');
    expect(markup).not.toContain("Cargando pregunta…");
  });

  it("offers a retry without revealing the question when activation fails", () => {
    useSession.mockReturnValue({
      ...initialSessionState("preparing"),
      question,
      lifecycleError: { operation: "activate", message: "No hemos podido activar el nivel." },
      retryLifecycle: vi.fn(),
    });
    const markup = renderGame();

    expect(markup).toContain("No hemos podido activar el nivel.");
    expect(markup).toContain("Reintentar partida");
    expect(markup).not.toContain(question.question);
    expect(markup).not.toContain('role="timer"');
  });
});
