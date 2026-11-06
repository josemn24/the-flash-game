import { describe, expect, it } from "vitest";
import type { EvaluationContext } from "@/application/ports/attempt-commands";
import { evaluateWithPublishedAcceptedAnswers } from "@/application/administration/evaluate-answer-regrade";
import type { DurationMs } from "@/types/domain/values";
import { supabaseCompetitiveEvaluator } from "./competitive-evaluator";

const tags = {
  domains: [],
  topics: [],
  cognitiveSkills: [],
  formatSkills: [],
  lifeSkills: [],
};

function context(
  questionType: "short-text" | "progressive-clues" = "short-text",
): EvaluationContext {
  const progressive = questionType === "progressive-clues";
  return {
    receiptId: "00000000-0000-4000-8000-000000000001" as never,
    questionVersionId: "00000000-0000-4000-8000-000000000002" as never,
    questionType,
    payloadSchemaVersion: 1,
    itemConfigSchemaVersion: 1,
    publicPayload: {
      category: "Geografía",
      tags,
      question: "¿Qué paisaje aparece en la imagen?",
      ...(progressive
        ? { clues: ["Pista uno", "Pista dos", "Pista tres"], cluePenalty: 1 }
        : { answerPlaceholder: null }),
    },
    solutionPayload: {
      correctAnswer: "Gran Cañón",
      acceptedAnswers: ["Gran Cañón"],
    },
    timeLimitMs: 25_000 as DurationMs,
    itemPoints: 7,
    itemConfig: {},
    mode: "flash",
    modeConfigSchemaVersion: 1,
    modeConfig: {},
    answer: "Cañon",
    receivedAt: "2026-11-06T10:00:06.556Z" as never,
    timeUsedMs: 6_556 as DurationMs,
    timedOut: false,
    progressiveCluesRevealed: progressive ? 3 : 1,
    progressiveClueAvailablePoints: progressive ? 4 : undefined,
  };
}

describe("published accepted-answer regrading", () => {
  it("recognizes an answer added to the selected rubric while preserving the original solution", () => {
    const original = context();
    const oldEvaluation = evaluateWithPublishedAcceptedAnswers(
      supabaseCompetitiveEvaluator,
      original,
      ["Gran Cañón"],
    );
    const proposed = evaluateWithPublishedAcceptedAnswers(supabaseCompetitiveEvaluator, original, [
      "Gran Cañón",
      "Cañón",
    ]);

    expect(oldEvaluation).toMatchObject({ status: "incorrect", points: 0 });
    expect(proposed.status).toBe("correct");
    expect(proposed.points).toBeGreaterThan(0);
    expect(proposed.points).toBeLessThanOrEqual(original.itemPoints);
    expect(
      evaluateWithPublishedAcceptedAnswers(supabaseCompetitiveEvaluator, original, ["Cañón"])
        .status,
    ).toBe("correct");
    expect(original.solutionPayload).toMatchObject({ acceptedAnswers: ["Gran Cañón"] });
  });

  it("uses the attempt's saved progressive clue allowance", () => {
    const attemptContext = context("progressive-clues");
    const proposed = evaluateWithPublishedAcceptedAnswers(
      supabaseCompetitiveEvaluator,
      attemptContext,
      ["Gran Cañón", "Cañón"],
    );

    expect(proposed.status).toBe("correct");
    expect(proposed.points).toBeLessThanOrEqual(4);
    expect(proposed.details).toMatchObject({ revealedClues: 3, availablePoints: 4 });
  });

  it("does not re-evaluate empty or timed-out answers", () => {
    expect(() =>
      evaluateWithPublishedAcceptedAnswers(
        supabaseCompetitiveEvaluator,
        { ...context(), answer: "  " },
        ["Cañón"],
      ),
    ).toThrow("invalid_command");
    expect(() =>
      evaluateWithPublishedAcceptedAnswers(
        supabaseCompetitiveEvaluator,
        { ...context(), timedOut: true },
        ["Cañón"],
      ),
    ).toThrow("invalid_command");
  });
});
