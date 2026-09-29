import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PyramidPreparingStage } from "./ServerFlashPopPyramidGame.client";
import type { ServerPyramidChallenge } from "@/types/gameplay/challenge";

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

describe("PyramidPreparingStage", () => {
  it("communicates preparation accessibly without exposing a timer", () => {
    const markup = renderToStaticMarkup(
      <PyramidPreparingStage challenge={challenge} currentIndex={0} />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Preparando el nivel 1");
    expect(markup).toContain("Cargando tu prueba");
    expect(markup).not.toContain('role="timer"');
  });
});
